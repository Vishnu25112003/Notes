const store = new Map();
const TTL_MS = 5 * 60 * 1000;

export function setChallenge(key, challenge) {
  store.set(key, { challenge, expiresAt: Date.now() + TTL_MS });
}

export function getChallenge(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.challenge;
}

export function deleteChallenge(key) {
  store.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 10 * 60 * 1000);
