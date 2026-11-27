import { importAesKey, passwordKek, recoveryKek, unwrapVaultKeyRaw, SLOT } from '../crypto/keys.js';
import { decryptItem, openCategory } from '../crypto/items.js';
import { parseRecoveryKey } from '../crypto/recovery.js';
import { wipe } from '../crypto/encoding.js';

export const BACKUP_FORMAT = 'notespace-vault-backup';

// The encrypted backup is exactly what the server stores: wrapped keys plus ciphertext. It opens with the
// master password or the recovery key that were current when it was made.
export function buildBackup({ username, meta, records, categories }) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    account: username,
    kdf: meta.kdf,
    wrappedKeyPwd: meta.wrappedKeyPwd,
    wrappedKeyRecovery: meta.wrappedKeyRecovery,
    categories: categories.map(c => ({ id: c.id, data: c.data })),
    items: records.filter(r => !r.deletedAt).map(r => ({ id: r.id, categoryId: r.categoryId, wrappedItemKey: r.wrappedItemKey, data: r.data, version: r.version })),
  };
}

export function readBackupFile(text) {
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("This isn't a Notespace vault backup"); }
  if (json?.format !== BACKUP_FORMAT || !Array.isArray(json.items)) throw new Error("This isn't a Notespace vault backup");
  return json;
}

// Decrypts a backup in memory. `secret` is { password } or { recoveryKey }.
export async function openBackup(backup, secret) {
  let raw;
  try {
    if (secret.password) {
      raw = await unwrapVaultKeyRaw(await passwordKek(secret.password, backup.kdf), backup.wrappedKeyPwd, SLOT.pwd);
    } else {
      const bytes = parseRecoveryKey(secret.recoveryKey);
      try { raw = await unwrapVaultKeyRaw(await recoveryKek(bytes), backup.wrappedKeyRecovery, SLOT.recovery); } finally { wipe(bytes); }
    }
  } catch (err) {
    if (err.message?.includes('recovery key has')) throw err;
    throw new Error(secret.password ? 'Wrong password for this backup' : "That recovery key doesn't open this backup");
  }
  const key = await importAesKey(raw);
  wipe(raw);
  const categories = [];
  for (const c of backup.categories || []) {
    try { categories.push({ id: c.id, ...(await openCategory(key, c)) }); } catch { /* skip damaged */ }
  }
  const items = [];
  let failed = 0;
  for (const r of backup.items) {
    try { items.push({ categoryId: r.categoryId, data: await decryptItem(key, r) }); } catch { failed++; }
  }
  return { items, categories, failed };
}
