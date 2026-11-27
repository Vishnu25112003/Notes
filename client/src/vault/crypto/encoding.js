export const utf8 = new TextEncoder();
export const utf8d = new TextDecoder();

export function toB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// 24 hex chars, the same shape as a MongoDB ObjectId, so the browser can name an item before it is encrypted
export function newId() {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  return ts + Array.from(randomBytes(8), b => b.toString(16).padStart(2, '0')).join('');
}

// Best effort only: JavaScript strings can't be wiped, but typed arrays can
export function wipe(...arrays) {
  for (const a of arrays) if (a instanceof Uint8Array) a.fill(0);
}
