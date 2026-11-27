import words from './wordlist.js';

const SETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

// Uniform index in [0, n) with rejection sampling, so no character is favoured
function randomIndex(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

export function generatePassword({ length = 20, upper = true, lower = true, digits = true, symbols = true } = {}) {
  const chosen = Object.entries({ upper, lower, digits, symbols }).filter(([, on]) => on).map(([k]) => SETS[k]);
  if (!chosen.length) chosen.push(SETS.lower);
  const all = chosen.join('');
  const n = Math.max(8, Math.min(64, length));
  // One from each chosen set guarantees site rules like "must contain a digit", then shuffle
  const chars = chosen.map(set => set[randomIndex(set.length)]);
  while (chars.length < n) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generatePassphrase({ words: count = 6, separator = '-', capitalize = true, number = true } = {}) {
  const parts = [];
  for (let i = 0; i < Math.max(4, Math.min(12, count)); i++) {
    const w = words[randomIndex(words.length)];
    parts.push(capitalize ? w[0].toUpperCase() + w.slice(1) : w);
  }
  if (number) parts[randomIndex(parts.length)] += String(randomIndex(10));
  return parts.join(separator);
}

export const passphraseWordCount = words.length;
