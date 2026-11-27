import { encrypt, decrypt } from '../crypto/keys.js';
import { utf8, toB64, fromB64 } from '../crypto/encoding.js';

// QR unlock crypto. The PC makes a one-time ECDH key pair and puts the public half in the QR (URL fragment,
// never sent to the server). The phone answers with the raw Vault Key encrypted to it.

const CURVE = { name: 'ECDH', namedCurve: 'P-256' };
const aad = (linkId) => `ns-link:v1:${linkId}`;
const b64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sessionKey(privateKey, publicRaw, linkId) {
  const pub = await crypto.subtle.importKey('raw', publicRaw, CURVE, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, privateKey, 256);
  const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8.encode('notespace-vault-link'), info: utf8.encode(`link-v1:${linkId}`) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// Six digits both screens show, so you can see the phone is answering this exact QR
export async function matchCode(linkId, pubB64url) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(`${linkId}.${pubB64url}`)));
  const n = ((d[0] << 16) | (d[1] << 8) | d[2]) % 1000000;
  const s = String(n).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

// PC side
export async function newLinkKeyPair() {
  const pair = await crypto.subtle.generateKey(CURVE, false, ['deriveBits']);
  const pub = b64url(toB64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))));
  return { privateKey: pair.privateKey, pub };
}

export const linkUrl = (linkId, pub) => `${window.location.origin}/vault/link#${linkId}.${pub}`;

export async function openAnswer(privateKey, linkId, { phonePub, wrapped }) {
  const key = await sessionKey(privateKey, fromB64(phonePub), linkId);
  return decrypt(key, wrapped, aad(linkId)); // raw Vault Key bytes
}

// Phone side
export function parseLinkHash(hash) {
  const m = /^#?([a-f0-9]{24})\.([A-Za-z0-9_-]{40,120})$/.exec(hash || '');
  return m ? { linkId: m[1], pub: m[2] } : null;
}

export async function sealAnswer(rawVaultKey, linkId, pcPub) {
  const eph = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const key = await sessionKey(eph.privateKey, fromB64(pcPub), linkId);
  const wrapped = await encrypt(key, rawVaultKey, aad(linkId));
  const phonePub = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey)));
  return { phonePub, wrapped };
}
