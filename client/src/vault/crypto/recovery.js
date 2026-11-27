import { randomBytes } from './encoding.js';

// 256-bit recovery key shown as 13 groups of 4 Crockford base32 characters (52 chars, 260 bits of room)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newRecoveryKey() {
  const bytes = randomBytes(32);
  return { bytes, text: format(encode(bytes)) };
}

function encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = ((value << 8) | b) & 0xffff; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out; // 52 chars for 32 bytes
}

const format = (s) => s.match(/.{1,4}/g).join('-');

// Accepts lowercase, spaces, dashes, and the usual look-alikes (O→0, I/L→1)
export function parseRecoveryKey(text) {
  const clean = String(text).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (clean.length !== 52) throw new Error('A recovery key has 52 characters (13 groups of 4)');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`"${ch}" is not a recovery key character`);
    value = ((value << 5) | v) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out.slice(0, 32));
}
