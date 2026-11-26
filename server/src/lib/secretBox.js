import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM for server-held secrets (TOTP seeds). Stored as "v1:<iv>:<tag>:<ciphertext>" in base64url.
const PREFIX = 'v1:';

let cachedKey = null;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOTP_ENC_KEY;
  if (!raw) throw new Error('TOTP_ENC_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TOTP_ENC_KEY must be 32 bytes, base64-encoded');
  cachedKey = key;
  return key;
}

// Fail fast at boot instead of on the first login attempt
export function assertSecretBoxKey() {
  getKey();
}

export function isSealed(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function seal(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map(b => b.toString('base64url')).join(':');
}

export function open(sealed) {
  if (!isSealed(sealed)) throw new Error('Value is not sealed');
  const [iv, tag, ct] = sealed.slice(PREFIX.length).split(':').map(s => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
