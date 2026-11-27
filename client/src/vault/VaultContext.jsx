import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { vaultApi, lockBeacon } from '../api/vault.js';
import { importAesKey, passwordKek, recoveryKek, prfKek, unwrapVaultKeyRaw, wrapVaultKey, newKdfParams, SLOT } from './crypto/keys.js';
import { decryptItem, sealNewItem, sealItemUpdate, sealCategory, openCategory, unwrapItemKeyRaw, decryptItemWithKey } from './crypto/items.js';
import { openPrivateKey, unwrapShared, wrapForRecipient } from './crypto/ecdh.js';
import { parseRecoveryKey } from './crypto/recovery.js';
import { newId, wipe } from './crypto/encoding.js';
import { assertWithPrf, getDeviceCredential, setDeviceCredential, localPrf } from './lib/passkey.js';
import { offlineStore } from './lib/offlineStore.js';
import { clearClipboardNow } from './lib/clipboard.js';

const VaultContext = createContext(null);
const REVEAL_GRACE_MS = 60 * 1000;

export class ConflictError extends Error {
  constructor(mine, theirs) {
    super('Changed on another device');
    this.mine = mine;
    this.theirs = theirs;
  }
}

/*
  The Vault Key lives only in this provider, as a non-extractable CryptoKey in a ref. It is never put in React
  state, storage, or the URL. Locking drops every reference and all decrypted data. The provider is mounted only
  under /vault, so leaving the vault also locks it.
*/
export function VaultProvider({ children }) {
  const { username } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading | nosetup | locked | unlocked | error
  const [statusInfo, setStatusInfo] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shared, setShared] = useState([]);
  const [meta, setMeta] = useState(null);
  const [pendingOps, setPendingOps] = useState(0);
  const [conflicts, setConflicts] = useState([]);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [reverify, setReverify] = useState(null); // { resolve, reject, reason }
  const [loadError, setLoadError] = useState(null);

  const keyRef = useRef(null);
  const ecdhRef = useRef(null);
  const recordsRef = useRef(new Map());
  const metaRef = useRef(null);
  const verifiedAtRef = useRef(0);
  const ceremonyRef = useRef(0);
  const idleTimerRef = useRef(null);
  const flushingRef = useRef(false);
  const recoveryRawRef = useRef(null);

  // ── Lock ────────────────────────────────────────────────────────────────────

  const lock = useCallback((reason = 'manual') => {
    keyRef.current = null;
    ecdhRef.current = null;
    recordsRef.current = new Map();
    verifiedAtRef.current = 0;
    setItems([]); setShared([]); setCategories([]); setConflicts([]);
    setMustResetPassword(false);
    setReverify(r => { r?.reject(new Error('Vault locked')); return null; });
    if (reason !== 'server' && navigator.onLine !== false) lockBeacon();
    setPhase(p => (p === 'unlocked' ? 'locked' : p));
    setStatusInfo(si => (si && metaRef.current ? { ...si, setup: true, passkeyCount: metaRef.current.passkeys.length } : si));
    // Not on 'hidden': copying a password and switching apps to paste it is the normal flow; the 30 s timer covers it
    if (reason === 'idle' || reason === 'manual') clearClipboardNow();
  }, []);

  // Some platforms hide the page while a passkey sheet or file picker is open; don't lock in the middle of one
  const duringCeremony = useCallback(async (fn) => {
    ceremonyRef.current++;
    try { return await fn(); } finally { setTimeout(() => { ceremonyRef.current--; }, 1500); }
  }, []);

  // ── Status ──────────────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    try {
      const s = await vaultApi.status();
      setOffline(false);
      setStatusInfo(s);
      setPhase(p => (p === 'unlocked' ? p : s.setup ? 'locked' : 'nosetup'));
      return s;
    } catch (err) {
      if (err.offline) {
        setOffline(true);
        const cachedMeta = await offlineStore.get(username, 'meta');
        if (cachedMeta) {
          setStatusInfo({ setup: true, passkeyCount: cachedMeta.passkeys.length, autoLockMinutes: cachedMeta.settings.autoLockMinutes, cachedOnly: true });
          setPhase(p => (p === 'unlocked' ? p : 'locked'));
          return null;
        }
      }
      setLoadError(err.message);
      setPhase('error');
      return null;
    }
  }, [username]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Decrypt helpers ─────────────────────────────────────────────────────────

  const decryptRecord = useCallback(async (r) => {
    try {
      const data = await decryptItem(keyRef.current, r);
      return { ...r, data, broken: false };
    } catch {
      return { ...r, data: null, broken: true };
    }
  }, []);

  const publishItems = useCallback(async () => {
    const list = await Promise.all([...recordsRef.current.values()].map(decryptRecord));
    if (!keyRef.current) return;
    setItems(list);
  }, [decryptRecord]);

  const cacheRecords = useCallback(() => {
    offlineStore.set(username, 'items', [...recordsRef.current.values()]);
  }, [username]);

  const loadShared = useCallback(async (rows) => {
    const m = metaRef.current;
    const list = await Promise.all(rows.map(async (s) => {
      try {
        const key = await unwrapShared(ecdhRef.current, m.ecdhPublicKey, s);
        const data = await decryptItemWithKey(key, { id: s.itemId, version: s.version, data: s.data });
        return { ...s, data, broken: false };
      } catch {
        return { ...s, data: null, broken: true };
      }
    }));
    if (keyRef.current) setShared(list);
  }, []);

  // ── Load data after unlock ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const vk = keyRef.current;
    if (!vk) return;
    let rows, cats, sharedRows;
    try {
      const [i, c, sh] = await Promise.all([vaultApi.items(), vaultApi.categories(), vaultApi.shared()]);
      rows = i.items; cats = c.categories; sharedRows = sh.shared;
      setOffline(false);
      offlineStore.set(username, 'items', rows);
      offlineStore.set(username, 'categories', cats);
      offlineStore.set(username, 'shared', sharedRows);
    } catch (err) {
      if (!err.offline) throw err;
      setOffline(true);
      rows = (await offlineStore.get(username, 'items')) || [];
      cats = (await offlineStore.get(username, 'categories')) || [];
      sharedRows = (await offlineStore.get(username, 'shared')) || [];
    }
    // Edits still waiting in the outbox are already in the cached records; re-apply them over fresh server data
    const outbox = await offlineStore.outbox(username);
    const map = new Map(rows.map(r => [r.id, r]));
    for (const op of outbox) applyLocal(map, op);
    recordsRef.current = map;
    setPendingOps(outbox.length);

    const openCats = await Promise.all(cats.map(async c => {
      try { return { id: c.id, ...(await openCategory(vk, c)) }; } catch { return null; }
    }));
    setCategories(openCats.filter(Boolean));
    await publishItems();
    await loadShared(sharedRows);
  }, [username, publishItems, loadShared]);

  // ── Unlock (gate 1 on the server, gate 2 here) ──────────────────────────────

  const enter = useCallback(async (raw, m) => {
    try {
      keyRef.current = await importAesKey(raw, ['encrypt', 'decrypt']);
    } finally { wipe(raw); }
    ecdhRef.current = await openPrivateKey(keyRef.current, m.wrappedEcdhPrivate);
    metaRef.current = m;
    setMeta(m);
    offlineStore.set(username, 'meta', m);
    verifiedAtRef.current = Date.now();
    setLoadError(null);
    await loadData();
    setPhase('unlocked');
  }, [username, loadData]);

  const getMetaOnline = useCallback(async () => {
    const m = await vaultApi.meta();
    return m;
  }, []);

  const unlockWithPasskey = useCallback(async () => {
    return duringCeremony(async () => {
      const { options, prfSalts } = await vaultApi.stepUpOptions();
      const device = getDeviceCredential();
      const onlyCredential = device && options.allowCredentials.some(c => c.id === device) ? device : undefined;
      const { credential, prf, credentialID } = await assertWithPrf(options, prfSalts, { onlyCredential });
      await vaultApi.stepUpVerify(credential);
      const m = await getMetaOnline();
      const pk = m.passkeys.find(p => p.credentialID === credentialID);
      if (!pk) throw new Error('This passkey is no longer enrolled');
      const raw = await unwrapVaultKeyRaw(await prfKek(prf), pk.wrappedKey, SLOT.prf(credentialID)).catch(() => {
        throw new Error("This passkey couldn't open the vault. Use your master password and re-enrol this device.");
      });
      wipe(prf);
      setDeviceCredential(credentialID);
      await enter(raw, m);
    });
  }, [duringCeremony, enter, getMetaOnline]);

  const unlockWithPassword = useCallback(async (code, password) => {
    let m;
    if (offline || statusInfo?.cachedOnly) {
      m = await offlineStore.get(username, 'meta');
      if (!m) throw new Error('No offline copy of the vault on this device');
    } else {
      await vaultApi.stepUpTotp(code);
      m = await getMetaOnline();
    }
    let raw;
    try {
      raw = await unwrapVaultKeyRaw(await passwordKek(password, m.kdf), m.wrappedKeyPwd, SLOT.pwd);
    } catch {
      throw new Error('Wrong master password');
    }
    await enter(raw, m);
  }, [offline, statusInfo, username, enter, getMetaOnline]);

  const unlockOfflinePasskey = useCallback(async () => {
    const m = await offlineStore.get(username, 'meta');
    const device = getDeviceCredential();
    const pk = m?.passkeys.find(p => p.credentialID === device);
    if (!pk) throw new Error('This device has no vault passkey in its offline copy');
    return duringCeremony(async () => {
      const prf = await localPrf(pk.credentialID, pk.prfSalt);
      const raw = await unwrapVaultKeyRaw(await prfKek(prf), pk.wrappedKey, SLOT.prf(pk.credentialID));
      wipe(prf);
      await enter(raw, m);
    });
  }, [username, duringCeremony, enter]);

  const unlockWithRecovery = useCallback(async (code, recoveryText) => {
    const bytes = parseRecoveryKey(recoveryText);
    await vaultApi.stepUpTotp(code);
    const m = await getMetaOnline();
    let raw;
    try {
      raw = await unwrapVaultKeyRaw(await recoveryKek(bytes), m.wrappedKeyRecovery, SLOT.recovery);
    } catch {
      throw new Error("That recovery key doesn't match this vault");
    } finally { wipe(bytes); }
    setMustResetPassword(true);
    // Keep a copy for the forced password reset; it is wiped as soon as the new password is set
    recoveryRawRef.current = raw.slice();
    await enter(raw, m);
  }, [enter, getMetaOnline]);

  // ── QR unlock ───────────────────────────────────────────────────────────────

  // PC: the phone's answer decrypted to the raw Vault Key; the poll that delivered it also opened gate 1
  const unlockWithLinkAnswer = useCallback(async (raw) => {
    const m = await getMetaOnline();
    await enter(raw, m);
  }, [enter, getMetaOnline]);

  // Phone: a fresh step-up that also yields the raw Vault Key, to encrypt for the PC.
  // Fingerprint (PRF) or authenticator code + master password; the server requires it within 2 minutes.
  const rawForTransfer = useCallback(async ({ method, code, password }) => {
    if (method === 'passkey') {
      return duringCeremony(async () => {
        const m = metaRef.current;
        const device = getDeviceCredential();
        const { options, prfSalts } = await vaultApi.stepUpOptions();
        const only = device && options.allowCredentials.some(c => c.id === device) ? device : undefined;
        const { credential, prf, credentialID } = await assertWithPrf(options, prfSalts, { onlyCredential: only });
        await vaultApi.stepUpVerify(credential);
        const pk = m.passkeys.find(p => p.credentialID === credentialID);
        try {
          return await unwrapVaultKeyRaw(await prfKek(prf), pk.wrappedKey, SLOT.prf(credentialID));
        } finally { wipe(prf); }
      });
    }
    await vaultApi.stepUpTotp(code);
    const m = metaRef.current;
    try {
      return await unwrapVaultKeyRaw(await passwordKek(password, m.kdf), m.wrappedKeyPwd, SLOT.pwd);
    } catch {
      throw new Error('Wrong master password');
    }
  }, [duringCeremony]);

  // ── Re-verify gate for reveal / copy / delete / export ──────────────────────

  const isRecentlyVerified = useCallback(() => Date.now() - verifiedAtRef.current < REVEAL_GRACE_MS, []);

  const ensureVerified = useCallback((reason) => {
    if (isRecentlyVerified()) return Promise.resolve(true);
    return new Promise((resolve, reject) => setReverify({ resolve, reject, reason }));
  }, [isRecentlyVerified]);

  // Always asks, ignoring the grace window (plain export, deleting the vault)
  const forceVerify = useCallback((reason, { passwordOnly = false } = {}) =>
    new Promise((resolve, reject) => setReverify({ resolve, reject, reason, passwordOnly })), []);

  const markVerified = useCallback(() => {
    verifiedAtRef.current = Date.now();
    setReverify(r => { r?.resolve(true); return null; });
  }, []);

  const cancelVerify = useCallback(() => {
    setReverify(r => { r?.reject(new Error('Cancelled')); return null; });
  }, []);

  // Proves it's still you without changing anything. Password: unwrap locally. Passkey: fresh UV assertion.
  const verifyWithPassword = useCallback(async (password) => {
    const m = metaRef.current;
    try {
      const raw = await unwrapVaultKeyRaw(await passwordKek(password, m.kdf), m.wrappedKeyPwd, SLOT.pwd);
      wipe(raw);
    } catch {
      throw new Error('Wrong master password');
    }
    markVerified();
  }, [markVerified]);

  const verifyWithPasskey = useCallback(async () => {
    await duringCeremony(async () => {
      const m = metaRef.current;
      const device = getDeviceCredential();
      const pk = m.passkeys.find(p => p.credentialID === device);
      if (!pk) throw new Error('No vault passkey on this device');
      if (offline) {
        const prf = await localPrf(pk.credentialID, pk.prfSalt);
        const raw = await unwrapVaultKeyRaw(await prfKek(prf), pk.wrappedKey, SLOT.prf(pk.credentialID));
        wipe(prf, raw);
      } else {
        const { options, prfSalts } = await vaultApi.stepUpOptions();
        const { credential, prf } = await assertWithPrf(options, prfSalts, { onlyCredential: pk.credentialID });
        // Checking the PRF unwrap too means the passkey really is the one that opens this vault
        const raw = await unwrapVaultKeyRaw(await prfKek(prf), pk.wrappedKey, SLOT.prf(pk.credentialID));
        wipe(prf, raw);
        await vaultApi.stepUpVerify(credential);
      }
    });
    markVerified();
  }, [duringCeremony, offline, markVerified]);

  // ── Auto-lock: idle timer and tab hidden ────────────────────────────────────

  const autoLockMinutes = meta?.settings?.autoLockMinutes || statusInfo?.autoLockMinutes || 5;

  useEffect(() => {
    if (phase !== 'unlocked') return undefined;
    const reset = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => lock('idle'), autoLockMinutes * 60 * 1000);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && ceremonyRef.current === 0) lock('hidden');
    };
    const onServerExpired = () => lock('server');
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    window.addEventListener('vault:ticket-expired', onServerExpired);
    reset();
    return () => {
      clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
      window.removeEventListener('vault:ticket-expired', onServerExpired);
    };
  }, [phase, autoLockMinutes, lock]);

  // Leaving /vault unmounts the provider: drop the key
  useEffect(() => () => { keyRef.current = null; ecdhRef.current = null; }, []);

  // ── Writes (online, or queued offline) ──────────────────────────────────────

  const runOrQueue = useCallback(async (op, online) => {
    if (!offline) {
      try {
        return await online();
      } catch (err) {
        if (!err.offline) throw err;
        setOffline(true);
      }
    }
    // Apply first: an offline update records the exact ciphertext it queued, needed if it later conflicts
    applyLocal(recordsRef.current, op);
    await offlineStore.enqueue(username, op);
    cacheRecords();
    setPendingOps(n => n + 1);
    await publishItems();
    return null;
  }, [offline, username, cacheRecords, publishItems]);

  const putRecord = useCallback(async (record) => {
    const prev = recordsRef.current.get(record.id);
    recordsRef.current.set(record.id, { ...prev, ...record, shareCount: record.shareCount ?? prev?.shareCount ?? 0 });
    cacheRecords();
    await publishItems();
  }, [cacheRecords, publishItems]);

  const createItem = useCallback(async (categoryId, input) => {
    const data = { history: [], ...input, passwordChangedAt: input.passwordChangedAt || (input.password ? new Date().toISOString() : null) };
    const sealed = await sealNewItem(keyRef.current, categoryId, data);
    const op = { type: 'create', id: sealed.id, body: { id: sealed.id, categoryId, wrappedItemKey: sealed.wrappedItemKey, data: sealed.data } };
    const res = await runOrQueue(op, () => vaultApi.createItem(op.body));
    if (res) await putRecord(res.item);
    return sealed.id;
  }, [runOrQueue, putRecord]);

  // Saves a new version. If the password changed, the old one goes into history (last 10).
  const updateItem = useCallback(async (id, categoryId, nextData, { base } = {}) => {
    const record = base || recordsRef.current.get(id);
    if (!record) throw new Error('Item not found');
    const current = items.find(i => i.id === id)?.data || {};
    const data = withHistory(current, nextData);
    const { body } = await sealItemUpdate(keyRef.current, record, categoryId, data);
    const op = { type: 'update', id, body };
    try {
      const res = await runOrQueue(op, () => vaultApi.updateItem(id, body));
      if (res) await putRecord(res.item);
    } catch (err) {
      if (err.status === 409 && err.data?.conflict) {
        const theirs = await decryptRecord(err.data.item);
        await putRecord(err.data.item);
        throw new ConflictError({ categoryId, data }, theirs);
      }
      throw err;
    }
  }, [items, runOrQueue, putRecord, decryptRecord]);

  const trashItem = useCallback(async (id) => {
    const op = { type: 'trash', id };
    const res = await runOrQueue(op, () => vaultApi.trashItem(id));
    if (res) await putRecord(res.item);
  }, [runOrQueue, putRecord]);

  const restoreItem = useCallback(async (id) => {
    const op = { type: 'restore', id };
    const res = await runOrQueue(op, () => vaultApi.restoreItem(id));
    if (res) await putRecord(res.item);
  }, [runOrQueue, putRecord]);

  const purgeItem = useCallback(async (id) => {
    const op = { type: 'purge', id };
    const res = await runOrQueue(op, () => vaultApi.purgeItem(id));
    if (res) { recordsRef.current.delete(id); cacheRecords(); await publishItems(); }
  }, [runOrQueue, cacheRecords, publishItems]);

  // ── Outbox flush when the connection returns ────────────────────────────────

  const flush = useCallback(async () => {
    if (flushingRef.current || !keyRef.current) return;
    flushingRef.current = true;
    try {
      const ops = await offlineStore.outbox(username);
      for (const op of ops) {
        try {
          await sendOp(op);
          await offlineStore.dequeue(op.seq);
        } catch (err) {
          if (err.offline) { setOffline(true); break; }
          if (err.data?.vaultLocked) break; // needs a step-up first; the ticket-expired event locks the vault
          if (err.status === 409 && err.data?.conflict && op.type === 'update') {
            // Park the offline edit as a conflict and drop it from the queue
            const theirs = await decryptRecord(err.data.item);
            const mineData = await decryptRecord({ ...op.queuedRecord });
            setConflicts(c => [...c, { id: op.id, mine: { categoryId: op.body.categoryId, data: mineData.data }, theirs }]);
          }
          await offlineStore.dequeue(op.seq);
        }
      }
      setPendingOps((await offlineStore.outbox(username)).length);
      await loadData();
    } finally {
      flushingRef.current = false;
    }
  }, [username, decryptRecord, loadData]);

  useEffect(() => {
    const goOnline = () => { setOffline(false); if (phase === 'unlocked') flush(); else refreshStatus(); };
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [phase, flush, refreshStatus]);

  useEffect(() => {
    if (phase === 'unlocked' && !offline && pendingOps > 0) flush();
  }, [phase, offline, pendingOps, flush]);

  const resolveConflict = useCallback(async (conflict, choice) => {
    setConflicts(c => c.filter(x => x !== conflict));
    if (choice === 'theirs') return;
    if (choice === 'mine') {
      const base = recordsRef.current.get(conflict.id);
      await updateItem(conflict.id, conflict.mine.categoryId, conflict.mine.data, { base });
    } else if (choice === 'both') {
      await createItem(conflict.mine.categoryId, { ...conflict.mine.data, title: `${conflict.mine.data.title || 'Untitled'} (my copy)` });
    }
  }, [updateItem, createItem]);

  // ── Custom categories ───────────────────────────────────────────────────────

  const saveCategory = useCallback(async (cat) => {
    const id = cat.id || newId();
    const body = { name: cat.name.trim().slice(0, 40), icon: cat.icon || 'tag', template: (cat.template || []).slice(0, 20) };
    const data = await sealCategory(keyRef.current, id, body);
    if (cat.id) await vaultApi.updateCategory(id, { data });
    else await vaultApi.createCategory({ id, data });
    setCategories(list => [...list.filter(c => c.id !== id), { id, ...body }]);
    return id;
  }, []);

  const deleteCategory = useCallback(async (id) => {
    await vaultApi.deleteCategory(id);
    setCategories(list => list.filter(c => c.id !== id));
    await loadData();
  }, [loadData]);

  // ── Key management (settings) ───────────────────────────────────────────────

  // Re-wrapping needs the raw Vault Key, which the in-memory key can't give back. The master password
  // (or the recovery key during a reset) unwraps a fresh copy just for the operation.
  const rawFromPassword = useCallback(async (password) => {
    const m = metaRef.current;
    try {
      return await unwrapVaultKeyRaw(await passwordKek(password, m.kdf), m.wrappedKeyPwd, SLOT.pwd);
    } catch {
      throw new Error('Wrong master password');
    }
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const raw = mustResetPassword && recoveryRawRef.current ? recoveryRawRef.current.slice() : await rawFromPassword(currentPassword);
    try {
      const kdf = newKdfParams();
      const wrappedKeyPwd = await wrapVaultKey(await passwordKek(newPassword, kdf), raw, SLOT.pwd);
      await vaultApi.changePassword({ kdf, wrappedKeyPwd });
      const m = { ...metaRef.current, kdf, wrappedKeyPwd };
      metaRef.current = m; setMeta(m); offlineStore.set(username, 'meta', m);
    } finally { wipe(raw); }
    if (recoveryRawRef.current) { wipe(recoveryRawRef.current); recoveryRawRef.current = null; }
    setMustResetPassword(false);
  }, [mustResetPassword, rawFromPassword, username]);

  const withRawKey = useCallback(async (password, fn) => {
    const raw = await rawFromPassword(password);
    try { return await fn(raw); } finally { wipe(raw); }
  }, [rawFromPassword]);

  const refreshMeta = useCallback(async () => {
    const m = await vaultApi.meta();
    metaRef.current = m; setMeta(m); offlineStore.set(username, 'meta', m);
    return m;
  }, [username]);

  const updateAutoLock = useCallback(async (minutes) => {
    await vaultApi.updateSettings({ autoLockMinutes: minutes });
    const m = { ...metaRef.current, settings: { ...metaRef.current.settings, autoLockMinutes: minutes } };
    metaRef.current = m; setMeta(m); offlineStore.set(username, 'meta', m);
  }, [username]);

  const deleteVault = useCallback(async () => {
    await vaultApi.deleteVault();
    await offlineStore.clear(username);
    setDeviceCredential(null);
    keyRef.current = null; ecdhRef.current = null; recordsRef.current = new Map();
    setItems([]); setShared([]); setCategories([]); setMeta(null);
    setPhase('nosetup');
  }, [username]);

  // ── Sharing ─────────────────────────────────────────────────────────────────

  const shareItem = useCallback(async (itemId, recipient) => {
    const record = recordsRef.current.get(itemId);
    const raw = await unwrapItemKeyRaw(keyRef.current, record.id, record.wrappedItemKey);
    try {
      const wrapped = await wrapForRecipient(raw, recipient.publicKey, itemId);
      const res = await vaultApi.createShare(itemId, { recipientUsername: recipient.username, ...wrapped });
      await putRecord({ ...record, shareCount: (record.shareCount || 0) + 1 });
      return res.share;
    } finally { wipe(raw); }
  }, [putRecord]);

  // Revoking deletes their wrapped key, then rotates the item key so a copy they kept can't open future versions.
  // The password itself may already be known to them, so the item is flagged with a change reminder.
  const revokeShare = useCallback(async (itemId, shareId) => {
    await vaultApi.revokeShare(shareId);
    const { shares } = await vaultApi.itemShares(itemId);
    const record = recordsRef.current.get(itemId);
    const current = items.find(i => i.id === itemId)?.data || {};
    const data = { ...current, rotateReminder: { at: new Date().toISOString() } };
    const { body, rawItemKey } = await sealItemUpdate(keyRef.current, record, record.categoryId, data, { rotate: true });
    try {
      body.shares = await Promise.all(shares.map(async s => ({ shareId: s.id, ...(await wrapForRecipient(rawItemKey, s.recipientKey, itemId)) })));
    } finally { wipe(rawItemKey); }
    const res = await vaultApi.updateItem(itemId, body);
    await putRecord({ ...res.item, shareCount: shares.length });
    return shares;
  }, [items, putRecord]);

  const leaveShare = useCallback(async (shareId) => {
    await vaultApi.leaveShare(shareId);
    setShared(list => list.filter(s => s.shareId !== shareId));
  }, []);

  const reloadShared = useCallback(async () => {
    const { shared: rows } = await vaultApi.shared();
    offlineStore.set(username, 'shared', rows);
    await loadShared(rows);
  }, [username, loadShared]);

  const getVaultKey = useCallback(() => keyRef.current, []);
  const getRecords = useCallback(() => [...recordsRef.current.values()], []);

  const value = useMemo(() => ({
    phase, statusInfo, offline, items, categories, shared, meta, pendingOps, conflicts, mustResetPassword,
    reverify, loadError, autoLockMinutes,
    refreshStatus, enter, lock, duringCeremony,
    unlockWithPasskey, unlockWithPassword, unlockWithRecovery, unlockOfflinePasskey,
    ensureVerified, forceVerify, cancelVerify, verifyWithPassword, verifyWithPasskey, isRecentlyVerified,
    createItem, updateItem, trashItem, restoreItem, purgeItem, resolveConflict, flush,
    saveCategory, deleteCategory,
    changePassword, withRawKey, refreshMeta, updateAutoLock, deleteVault,
    shareItem, revokeShare, leaveShare, reloadShared, getVaultKey, getRecords, unlockWithLinkAnswer, rawForTransfer,
  }), [phase, statusInfo, offline, items, categories, shared, meta, pendingOps, conflicts, mustResetPassword,
    reverify, loadError, autoLockMinutes, refreshStatus, enter, lock, duringCeremony,
    unlockWithPasskey, unlockWithPassword, unlockWithRecovery, unlockOfflinePasskey,
    ensureVerified, forceVerify, cancelVerify, verifyWithPassword, verifyWithPasskey, isRecentlyVerified,
    createItem, updateItem, trashItem, restoreItem, purgeItem, resolveConflict, flush,
    saveCategory, deleteCategory, changePassword, withRawKey, refreshMeta, updateAutoLock, deleteVault,
    shareItem, revokeShare, leaveShare, reloadShared, getVaultKey, getRecords, unlockWithLinkAnswer, rawForTransfer]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  return useContext(VaultContext);
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function withHistory(current, next) {
  const data = { ...next };
  const oldPw = current?.password || '';
  if (oldPw && next.password !== oldPw) {
    data.history = [{ password: oldPw, changedAt: current.passwordChangedAt || new Date().toISOString() }, ...(current.history || [])].slice(0, 10);
    data.passwordChangedAt = new Date().toISOString();
    delete data.rotateReminder;
  } else {
    data.history = current?.history || next.history || [];
    data.passwordChangedAt = current?.passwordChangedAt || next.passwordChangedAt || (next.password ? new Date().toISOString() : null);
  }
  return data;
}

// Mirrors a queued operation onto the local record map so the UI reflects offline edits immediately
function applyLocal(map, op) {
  const now = new Date().toISOString();
  if (op.type === 'create') {
    map.set(op.id, { id: op.id, categoryId: op.body.categoryId, wrappedItemKey: op.body.wrappedItemKey, data: op.body.data, version: 1, deletedAt: null, createdAt: now, updatedAt: now, shareCount: 0, pending: true });
  } else if (op.type === 'update') {
    const r = map.get(op.id);
    if (r) {
      op.queuedRecord = { ...r, data: op.body.data, version: op.body.expectedVersion + 1, categoryId: op.body.categoryId };
      map.set(op.id, { ...op.queuedRecord, updatedAt: now, pending: true });
    }
  } else if (op.type === 'trash') {
    const r = map.get(op.id); if (r) map.set(op.id, { ...r, deletedAt: now, pending: true });
  } else if (op.type === 'restore') {
    const r = map.get(op.id); if (r) map.set(op.id, { ...r, deletedAt: null, pending: true });
  } else if (op.type === 'purge') {
    map.delete(op.id);
  }
}

function sendOp(op) {
  switch (op.type) {
    case 'create': return vaultApi.createItem(op.body);
    case 'update': return vaultApi.updateItem(op.id, op.body);
    case 'trash': return vaultApi.trashItem(op.id);
    case 'restore': return vaultApi.restoreItem(op.id);
    case 'purge': return vaultApi.purgeItem(op.id);
    default: return Promise.resolve();
  }
}
