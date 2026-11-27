import { encrypt, decrypt, encryptJson, decryptJson, importAesKey } from './keys.js';
import { randomBytes, newId, wipe } from './encoding.js';

// AAD binds every ciphertext to where it belongs. Moving item A's data onto item B, or onto another version, fails to decrypt.
export const aad = {
  itemKey: (id) => `ns-item-key:v1:${id}`,
  item: (id, version) => `ns-item:v1:${id}:${version}`,
  category: (id) => `ns-category:v1:${id}`,
};

export async function unwrapItemKeyRaw(vaultKey, id, wrappedItemKey) {
  return decrypt(vaultKey, wrappedItemKey, aad.itemKey(id));
}

async function itemKeyFromRaw(raw) {
  try { return await importAesKey(raw); } finally { wipe(raw); }
}

export async function decryptItem(vaultKey, record) {
  const key = await itemKeyFromRaw(await unwrapItemKeyRaw(vaultKey, record.id, record.wrappedItemKey));
  return decryptJson(key, record.data, aad.item(record.id, record.version));
}

// Decrypts with an item key the caller already holds (shared items)
export async function decryptItemWithKey(itemKey, record) {
  return decryptJson(itemKey, record.data, aad.item(record.id, record.version));
}

export async function sealNewItem(vaultKey, categoryId, data, id = newId()) {
  const raw = randomBytes(32);
  const wrappedItemKey = await encrypt(vaultKey, raw, aad.itemKey(id));
  const key = await itemKeyFromRaw(raw);
  return { id, categoryId, wrappedItemKey, data: await encryptJson(key, data, aad.item(id, 1)), version: 1 };
}

// Encrypts the next version. With rotate=true a fresh item key replaces the old one (after revoking a share),
// and the new raw key is returned so the caller can re-wrap it for the remaining recipients.
export async function sealItemUpdate(vaultKey, record, categoryId, data, { rotate = false } = {}) {
  const nextVersion = record.version + 1;
  let raw, wrappedItemKey;
  if (rotate) {
    raw = randomBytes(32);
    wrappedItemKey = await encrypt(vaultKey, raw, aad.itemKey(record.id));
  } else {
    raw = await unwrapItemKeyRaw(vaultKey, record.id, record.wrappedItemKey);
  }
  const key = await importAesKey(raw);
  const sealed = await encryptJson(key, data, aad.item(record.id, nextVersion));
  const result = { categoryId, data: sealed, expectedVersion: record.version, ...(rotate && { wrappedItemKey }) };
  if (rotate) return { body: result, rawItemKey: raw };
  wipe(raw);
  return { body: result };
}

export async function sealCategory(vaultKey, id, data) {
  return encryptJson(vaultKey, data, aad.category(id));
}

export async function openCategory(vaultKey, record) {
  return decryptJson(vaultKey, record.data, aad.category(record.id));
}
