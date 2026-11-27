// Encrypted vault cache on this device (IndexedDB). Holds only what the server holds: wrapped keys and ciphertext.
// Also an outbox of encrypted edits made offline, flushed in order when the connection returns.

const DB = 'notespace-vault';
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// Cache is keyed by username so two accounts on one device never see each other's cache
const k = (username, name) => `${username}:${name}`;

export const offlineStore = {
  available: () => typeof indexedDB !== 'undefined',
  async get(username, name) {
    try { return await tx('kv', 'readonly', s => reqP(s.get(k(username, name)))); } catch { return undefined; }
  },
  async set(username, name, value) {
    try { await tx('kv', 'readwrite', s => { s.put(value, k(username, name)); }); } catch { /* storage full or blocked */ }
  },
  async clear(username) {
    try {
      await tx('kv', 'readwrite', s => { ['meta', 'items', 'categories', 'shared'].forEach(n => s.delete(k(username, n))); });
      const all = await this.outbox(username);
      await tx('outbox', 'readwrite', s => { all.forEach(op => s.delete(op.seq)); });
    } catch { /* ignore */ }
  },
  async enqueue(username, op) {
    await tx('outbox', 'readwrite', s => { s.add({ ...op, username, queuedAt: Date.now() }); });
  },
  async outbox(username) {
    try {
      const all = await tx('outbox', 'readonly', s => reqP(s.getAll()));
      return (all || []).filter(op => op.username === username).sort((a, b) => a.seq - b.seq);
    } catch { return []; }
  },
  async dequeue(seq) {
    await tx('outbox', 'readwrite', s => { s.delete(seq); });
  },
};
