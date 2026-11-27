import { argon2id } from 'hash-wasm';
import { utf8, toB64, fromB64, randomBytes, wipe } from './encoding.js';

// Default Argon2id cost. Stored with the vault so it can be raised later without breaking old vaults.
export const DEFAULT_KDF = { alg: 'argon2id', m: 65536, t: 3, p: 1 };

const AES = { name: 'AES-GCM', length: 256 };

export async function importAesKey(raw, usages = ['encrypt', 'decrypt']) {
  // Non-extractable: once imported, the raw bytes can't be read back out of the CryptoKey
  return crypto.subtle.importKey('raw', raw, AES, false, usages);
}

export async function encrypt(key, plaintextBytes, aad) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8.encode(aad) }, key, plaintextBytes);
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function decrypt(key, { iv, ct }, aad) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv), additionalData: utf8.encode(aad) }, key, fromB64(ct));
  return new Uint8Array(pt);
}

export async function encryptJson(key, obj, aad) {
  const bytes = utf8.encode(JSON.stringify(obj));
  try { return await encrypt(key, bytes, aad); } finally { wipe(bytes); }
}

export async function decryptJson(key, c, aad) {
  const bytes = await decrypt(key, c, aad);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } finally { wipe(bytes); }
}

// ── Key-encryption keys ───────────────────────────────────────────────────────

export async function passwordKek(password, kdf) {
  const hash = await argon2id({
    password: password.normalize('NFKC'),
    salt: fromB64(kdf.salt),
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: 'binary',
  });
  try { return await importAesKey(hash); } finally { wipe(hash); }
}

export async function hkdfKek(secretBytes, label) {
  const base = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8.encode('notespace-vault'), info: utf8.encode(label) },
    base, AES, false, ['encrypt', 'decrypt']
  );
}

export const recoveryKek = (recoveryBytes) => hkdfKek(recoveryBytes, 'recovery-v1');
export const prfKek = (prfOutput) => hkdfKek(new Uint8Array(prfOutput), 'prf-v1');

// AAD names the slot a wrapped vault key belongs to, so a password-slot blob can't be replayed into another slot
export const SLOT = {
  pwd: 'ns-vault-key:v1:pwd',
  recovery: 'ns-vault-key:v1:recovery',
  prf: (credentialID) => `ns-vault-key:v1:prf:${credentialID}`,
};

export const wrapVaultKey = (kek, rawVaultKey, slot) => encrypt(kek, rawVaultKey, slot);

// Returns raw bytes; callers import them non-extractable and wipe the bytes
export const unwrapVaultKeyRaw = (kek, wrapped, slot) => decrypt(kek, wrapped, slot);

export function newKdfParams() {
  return { ...DEFAULT_KDF, salt: toB64(randomBytes(16)) };
}

export function newVaultKeyRaw() {
  return randomBytes(32);
}
