import { encrypt, decrypt, importAesKey } from './keys.js';
import { utf8, toB64, fromB64, wipe } from './encoding.js';

const CURVE = { name: 'ECDH', namedCurve: 'P-256' };
const PRIV_AAD = 'ns-ecdh-private:v1';
const shareAad = (itemId, recipientKey) => `ns-share:v1:${itemId}:${recipientKey}`;

export async function newKeyPair(vaultKey) {
  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  try {
    return { publicKey: toB64(pub), wrappedPrivate: await encrypt(vaultKey, pkcs8, PRIV_AAD) };
  } finally { wipe(pkcs8); }
}

export async function openPrivateKey(vaultKey, wrappedPrivate) {
  const pkcs8 = await decrypt(vaultKey, wrappedPrivate, PRIV_AAD);
  try { return await crypto.subtle.importKey('pkcs8', pkcs8, CURVE, false, ['deriveBits']); } finally { wipe(pkcs8); }
}

const importPublic = (b64) => crypto.subtle.importKey('raw', fromB64(b64), CURVE, false, []);

async function sharedKey(privateKey, publicKey, itemId) {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8.encode('notespace-vault-share'), info: utf8.encode(`share-v1:${itemId}`) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// Wraps one item key for one recipient with a throwaway ephemeral key pair
export async function wrapForRecipient(rawItemKey, recipientKey, itemId) {
  const eph = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const key = await sharedKey(eph.privateKey, await importPublic(recipientKey), itemId);
  const wrappedItemKey = await encrypt(key, rawItemKey, shareAad(itemId, recipientKey));
  const ephemeralPub = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey)));
  return { wrappedItemKey, ephemeralPub, recipientKey };
}

export async function unwrapShared(myPrivateKey, myPublicKey, share) {
  const key = await sharedKey(myPrivateKey, await importPublic(share.ephemeralPub), share.itemId);
  const raw = await decrypt(key, share.wrappedItemKey, shareAad(share.itemId, myPublicKey));
  try { return await importAesKey(raw); } finally { wipe(raw); }
}

// Short fingerprint of a public key. Both people read it out to each other to rule out a swapped key.
export async function safetyCode(publicKeyB64) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fromB64(publicKeyB64)));
  const groups = [];
  for (let i = 0; i < 12; i += 2) groups.push(String(((digest[i] << 8) | digest[i + 1]) % 10000).padStart(4, '0'));
  return groups.join(' ');
}
