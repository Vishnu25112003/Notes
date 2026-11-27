import mongoose from 'mongoose';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import User from '../models/User.js';
import VaultMeta from '../models/VaultMeta.js';
import VaultItem from '../models/VaultItem.js';
import VaultCategory from '../models/VaultCategory.js';
import VaultShare from '../models/VaultShare.js';
import { setChallenge, getChallenge, deleteChallenge } from '../lib/challengeStore.js';
import { issueTicket, clearTicketCookie, findTicket } from '../lib/vaultTicket.js';
import { hashToken } from '../lib/session.js';
import { verifyUserTotp, RP_NAME, RP_ID, RP_ORIGIN } from './authController.js';

// The server only ever stores and returns ciphertext. Everything here is about who may fetch it and when.

const TRASH_DAYS = 30;
const PURGE_EVERY_MS = 12 * 60 * 60 * 1000;
const MAX_ITEM_CT = 256 * 1024;      // base64 chars; a big secure note still fits
const MAX_KEY_CT = 512;
const BUILTIN_CATEGORIES = ['login', 'card', 'wifi', 'note'];
const OBJECT_ID = /^[a-f0-9]{24}$/;
const B64 = /^[A-Za-z0-9+/=_-]+$/;

const isB64 = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && B64.test(s);
const isCipher = (c, max = MAX_KEY_CT) => !!c && isB64(c.iv, 64) && isB64(c.ct, max);
const cipher = (c) => ({ iv: c.iv, ct: c.ct });
const bad = (res, error, status = 400) => res.status(status).json({ error });

async function isValidCategory(userId, categoryId) {
  if (BUILTIN_CATEGORIES.includes(categoryId)) return true;
  if (!OBJECT_ID.test(categoryId)) return false;
  return !!(await VaultCategory.exists({ _id: categoryId, userId }));
}

function publicItem(i) {
  return {
    id: String(i._id),
    categoryId: i.categoryId,
    wrappedItemKey: cipher(i.wrappedItemKey),
    data: cipher(i.data),
    version: i.version,
    deletedAt: i.deletedAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

// ── Status & setup ────────────────────────────────────────────────────────────

export async function status(req, res) {
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  if (!meta) return res.json({ setup: false });
  res.json({
    setup: true,
    unlocked: !!findTicket(req, meta),
    passkeyCount: meta.passkeys.length,
    autoLockMinutes: meta.settings.autoLockMinutes,
  });
}

export async function setup(req, res) {
  const { kdf, wrappedKeyPwd, wrappedKeyRecovery, ecdhPublicKey, wrappedEcdhPrivate } = req.body || {};
  if (await VaultMeta.exists({ userId: req.user.id })) return bad(res, 'Vault already exists', 409);
  if (!kdf || kdf.alg !== 'argon2id' || !isB64(kdf.salt, 64)) return bad(res, 'Invalid key derivation settings');
  // Floors so a tampered client can't quietly weaken the master password hashing
  if (!(kdf.m >= 19456 && kdf.m <= 1048576 && kdf.t >= 2 && kdf.t <= 10 && kdf.p >= 1 && kdf.p <= 4)) {
    return bad(res, 'Key derivation parameters are out of range');
  }
  if (!isCipher(wrappedKeyPwd) || !isCipher(wrappedKeyRecovery) || !isCipher(wrappedEcdhPrivate)) {
    return bad(res, 'Invalid wrapped keys');
  }
  if (!isB64(ecdhPublicKey, 200)) return bad(res, 'Invalid public key');

  const meta = new VaultMeta({
    userId: req.user.id,
    kdf: { alg: 'argon2id', salt: kdf.salt, m: kdf.m, t: kdf.t, p: kdf.p },
    wrappedKeyPwd: cipher(wrappedKeyPwd),
    wrappedKeyRecovery: cipher(wrappedKeyRecovery),
    ecdhPublicKey,
    wrappedEcdhPrivate: cipher(wrappedEcdhPrivate),
  });
  issueTicket(req, res, meta);
  await meta.save();
  res.status(201).json({ ok: true });
}

// ── Step-up (gate 1) ──────────────────────────────────────────────────────────

export async function stepUpWebAuthnOptions(req, res) {
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  if (!meta) return bad(res, 'Vault is not set up', 404);
  if (!meta.passkeys.length) return bad(res, 'No vault passkeys on this account');

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: meta.passkeys.map(p => ({ id: p.credentialID, transports: p.transports })),
    userVerification: 'required',
  });
  setChallenge(`vault:${req.user.id}`, options.challenge);
  const { rpId: _rpId, ...clientOptions } = options;
  // PRF salts aren't secret; the browser needs them before the ceremony to derive the per-device key
  const prfSalts = Object.fromEntries(meta.passkeys.map(p => [p.credentialID, p.prfSalt]));
  res.json({ options: clientOptions, prfSalts });
}

export async function stepUpWebAuthnVerify(req, res) {
  const { credential } = req.body || {};
  if (!credential?.id) return bad(res, 'Credential required');
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  if (!meta) return bad(res, 'Vault is not set up', 404);

  const expectedChallenge = getChallenge(`vault:${req.user.id}`);
  if (!expectedChallenge) return bad(res, 'Challenge expired, try again');
  const stored = meta.passkeys.find(p => p.credentialID === credential.id);
  if (!stored) return bad(res, 'This passkey is not enrolled for the vault', 422);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialID,
        publicKey: isoBase64URL.toBuffer(stored.credentialPublicKey),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
  } catch (err) {
    return bad(res, `Passkey verification failed: ${err.message}`, 422);
  }
  deleteChallenge(`vault:${req.user.id}`);
  if (!verification.verified) return bad(res, 'Passkey verification failed', 422);

  stored.counter = verification.authenticationInfo.newCounter;
  issueTicket(req, res, meta);
  await meta.save();
  res.json({ ok: true, credentialID: stored.credentialID });
}

export async function stepUpTotp(req, res) {
  const code = String(req.body?.code || '');
  if (!/^\d{6}$/.test(code)) return bad(res, 'Enter the 6-digit code', 422);
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  if (!meta) return bad(res, 'Vault is not set up', 404);
  const user = await User.findById(req.user.id);
  if (!user?.totpSecret) return bad(res, 'No authenticator on this account', 400);
  if (!(await verifyUserTotp(user, code))) return bad(res, 'That code is wrong or was already used', 422);
  await user.save();
  issueTicket(req, res, meta);
  await meta.save();
  res.json({ ok: true });
}

export async function lock(req, res) {
  const token = req.cookies?.ns_vault;
  if (token) {
    await VaultMeta.updateOne({ userId: req.user.id }, { $pull: { tickets: { tokenHash: hashToken(token) } } });
  }
  clearTicketCookie(res);
  res.json({ ok: true });
}

// ── Wrapped key material (gate 2 happens in the browser) ──────────────────────

export async function getMeta(req, res) {
  const m = req.vaultMeta;
  res.json({
    kdf: { alg: m.kdf.alg, salt: m.kdf.salt, m: m.kdf.m, t: m.kdf.t, p: m.kdf.p },
    wrappedKeyPwd: cipher(m.wrappedKeyPwd),
    wrappedKeyRecovery: cipher(m.wrappedKeyRecovery),
    passkeys: m.passkeys.map(p => ({
      credentialID: p.credentialID, prfSalt: p.prfSalt, wrappedKey: cipher(p.wrappedKey),
      deviceName: p.deviceName, addedAt: p.addedAt,
    })),
    ecdhPublicKey: m.ecdhPublicKey,
    wrappedEcdhPrivate: cipher(m.wrappedEcdhPrivate),
    settings: { autoLockMinutes: m.settings.autoLockMinutes },
    ticketExpiresAt: req.vaultTicket.expiresAt,
  });
}

export async function changePassword(req, res) {
  const { kdf, wrappedKeyPwd } = req.body || {};
  if (!kdf || kdf.alg !== 'argon2id' || !isB64(kdf.salt, 64) || !(kdf.m >= 19456 && kdf.t >= 2 && kdf.p >= 1)) {
    return bad(res, 'Invalid key derivation settings');
  }
  if (!isCipher(wrappedKeyPwd)) return bad(res, 'Invalid wrapped key');
  const m = req.vaultMeta;
  m.kdf = { alg: 'argon2id', salt: kdf.salt, m: kdf.m, t: kdf.t, p: kdf.p };
  m.wrappedKeyPwd = cipher(wrappedKeyPwd);
  await m.save();
  res.json({ ok: true });
}

export async function changeRecovery(req, res) {
  const { wrappedKeyRecovery } = req.body || {};
  if (!isCipher(wrappedKeyRecovery)) return bad(res, 'Invalid wrapped key');
  req.vaultMeta.wrappedKeyRecovery = cipher(wrappedKeyRecovery);
  await req.vaultMeta.save();
  res.json({ ok: true });
}

export async function updateSettings(req, res) {
  const minutes = Number(req.body?.autoLockMinutes);
  if (![1, 5, 15, 30].includes(minutes)) return bad(res, 'Auto-lock must be 1, 5, 15 or 30 minutes');
  req.vaultMeta.settings.autoLockMinutes = minutes;
  await req.vaultMeta.save();
  res.json({ ok: true, autoLockMinutes: minutes });
}

// Deletes the whole vault: items, categories, shares in both directions, and the key material
export async function deleteVault(req, res) {
  if (req.body?.confirm !== 'DELETE VAULT') return bad(res, 'Type DELETE VAULT to confirm');
  const userId = req.user.id;
  const itemIds = (await VaultItem.find({ userId }).select('_id').lean()).map(i => i._id);
  await VaultShare.deleteMany({ $or: [{ itemId: { $in: itemIds } }, { recipientId: userId }, { ownerId: userId }] });
  await VaultItem.deleteMany({ userId });
  await VaultCategory.deleteMany({ userId });
  await VaultMeta.deleteOne({ userId });
  clearTicketCookie(res);
  res.json({ ok: true });
}

// ── Device passkeys ───────────────────────────────────────────────────────────

export async function passkeyAddOptions(req, res) {
  const m = req.vaultMeta;
  const options = await generateRegistrationOptions({
    rpName: `${RP_NAME} Vault`,
    rpID: RP_ID,
    // A different user handle from the login passkey, so creating this one never overwrites it on the device
    userName: `${req.user.username} (vault)`,
    userID: Buffer.from(`vault:${req.user.id}`),
    attestationType: 'none',
    excludeCredentials: m.passkeys.map(p => ({ id: p.credentialID, transports: p.transports })),
    authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
  });
  setChallenge(`vaultreg:${req.user.id}`, options.challenge);
  res.json({ options: { ...options, rp: { name: options.rp.name } } });
}

export async function passkeyAddVerify(req, res) {
  const { credential, prfSalt, wrappedKey, deviceName } = req.body || {};
  if (!credential || !isB64(prfSalt, 64) || !isCipher(wrappedKey)) return bad(res, 'Missing passkey data');
  const expectedChallenge = getChallenge(`vaultreg:${req.user.id}`);
  if (!expectedChallenge) return bad(res, 'Challenge expired, try again');

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    return bad(res, `Passkey verification failed: ${err.message}`);
  }
  deleteChallenge(`vaultreg:${req.user.id}`);
  if (!verification.verified) return bad(res, 'Passkey verification failed');

  const { credential: cred } = verification.registrationInfo;
  const m = req.vaultMeta;
  if (m.passkeys.length >= 20) return bad(res, 'Remove an old device first (20 maximum)');
  m.passkeys.push({
    credentialID: cred.id,
    credentialPublicKey: isoBase64URL.fromBuffer(cred.publicKey),
    counter: cred.counter,
    transports: cred.transports || [],
    prfSalt,
    wrappedKey: cipher(wrappedKey),
    deviceName: String(deviceName || 'Device').slice(0, 60),
  });
  await m.save();
  res.status(201).json({ ok: true, credentialID: cred.id });
}

export async function passkeyRemove(req, res) {
  const m = req.vaultMeta;
  const before = m.passkeys.length;
  m.passkeys = m.passkeys.filter(p => p.credentialID !== req.params.credentialID);
  if (m.passkeys.length === before) return bad(res, 'Passkey not found', 404);
  await m.save();
  res.json({ ok: true });
}

// ── Items ─────────────────────────────────────────────────────────────────────

// Render's free tier has no cron, so trash older than 30 days is purged lazily on read
async function purgeTrashIfDue(meta) {
  if (meta.lastPurgeAt && Date.now() - meta.lastPurgeAt.getTime() < PURGE_EVERY_MS) return;
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  const old = await VaultItem.find({ userId: meta.userId, deletedAt: { $ne: null, $lt: cutoff } }).select('_id').lean();
  if (old.length) {
    const ids = old.map(i => i._id);
    await VaultShare.deleteMany({ itemId: { $in: ids } });
    await VaultItem.deleteMany({ _id: { $in: ids } });
  }
  await VaultMeta.updateOne({ _id: meta._id }, { $set: { lastPurgeAt: new Date() } });
}

export async function listItems(req, res) {
  await purgeTrashIfDue(req.vaultMeta);
  const items = await VaultItem.find({ userId: req.user.id }).lean();
  const shareCounts = await VaultShare.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(String(req.user.id)) } },
    { $group: { _id: '$itemId', n: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(shareCounts.map(s => [String(s._id), s.n]));
  res.json({ items: items.map(i => ({ ...publicItem(i), shareCount: counts[String(i._id)] || 0 })) });
}

export async function createItem(req, res) {
  const { id, categoryId, wrappedItemKey, data } = req.body || {};
  // The browser picks the id, because it is bound into the ciphertext's AAD before the item ever reaches us
  if (!OBJECT_ID.test(String(id))) return bad(res, 'Invalid item id');
  if (!(await isValidCategory(req.user.id, categoryId))) return bad(res, 'Unknown category');
  if (!isCipher(wrappedItemKey) || !isCipher(data, MAX_ITEM_CT)) return bad(res, 'Invalid ciphertext');
  if (await VaultItem.exists({ _id: id })) {
    // An offline retry of a create that already landed is fine; anything else is a collision
    const existing = await VaultItem.findOne({ _id: id, userId: req.user.id }).lean();
    if (existing) return res.status(200).json({ item: publicItem(existing) });
    return bad(res, 'Item id already in use', 409);
  }
  const item = await VaultItem.create({
    _id: id, userId: req.user.id, categoryId,
    wrappedItemKey: cipher(wrappedItemKey), data: cipher(data), version: 1,
  });
  res.status(201).json({ item: publicItem(item) });
}

export async function updateItem(req, res) {
  const { expectedVersion, categoryId, wrappedItemKey, data, shares } = req.body || {};
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  if (!Number.isInteger(expectedVersion)) return bad(res, 'expectedVersion is required');
  if (!(await isValidCategory(req.user.id, categoryId))) return bad(res, 'Unknown category');
  if (!isCipher(data, MAX_ITEM_CT) || (wrappedItemKey && !isCipher(wrappedItemKey))) return bad(res, 'Invalid ciphertext');

  // Key rotation (after a revoke) must re-wrap every remaining share in the same request
  const shareUpdates = Array.isArray(shares) ? shares : [];
  for (const s of shareUpdates) {
    if (!OBJECT_ID.test(String(s.shareId)) || !isCipher(s.wrappedItemKey) || !isB64(s.ephemeralPub, 200) || !isB64(s.recipientKey, 200)) {
      return bad(res, 'Invalid share update');
    }
  }
  if (wrappedItemKey) {
    const existingShares = await VaultShare.countDocuments({ itemId: req.params.id, ownerId: req.user.id });
    if (existingShares !== shareUpdates.length) return bad(res, 'A key rotation must re-wrap every share', 409);
  }

  const set = { categoryId, data: cipher(data), version: expectedVersion + 1 };
  if (wrappedItemKey) set.wrappedItemKey = cipher(wrappedItemKey);
  const item = await VaultItem.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, version: expectedVersion },
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!item) {
    const current = await VaultItem.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!current) return bad(res, 'Item not found', 404);
    // Someone saved first; hand back their version so the client can show both
    return res.status(409).json({ error: 'Changed on another device', conflict: true, item: publicItem(current) });
  }
  for (const s of shareUpdates) {
    await VaultShare.updateOne(
      { _id: s.shareId, itemId: item._id, ownerId: req.user.id },
      { $set: { wrappedItemKey: cipher(s.wrappedItemKey), ephemeralPub: s.ephemeralPub, recipientKey: s.recipientKey } }
    );
  }
  res.json({ item: publicItem(item) });
}

export async function trashItem(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  const item = await VaultItem.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!item) return bad(res, 'Item not found', 404);
  res.json({ item: publicItem(item) });
}

export async function restoreItem(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  const item = await VaultItem.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, deletedAt: { $ne: null } },
    { $set: { deletedAt: null } },
    { returnDocument: 'after' }
  );
  if (!item) return bad(res, 'Item not found in trash', 404);
  res.json({ item: publicItem(item) });
}

export async function purgeItem(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  const item = await VaultItem.findOneAndDelete({ _id: req.params.id, userId: req.user.id, deletedAt: { $ne: null } });
  if (!item) return bad(res, 'Only items in the trash can be deleted forever', 404);
  await VaultShare.deleteMany({ itemId: item._id });
  res.json({ ok: true });
}

// ── Custom categories ─────────────────────────────────────────────────────────

export async function listCategories(req, res) {
  const cats = await VaultCategory.find({ userId: req.user.id }).lean();
  res.json({ categories: cats.map(c => ({ id: String(c._id), data: cipher(c.data) })) });
}

export async function createCategory(req, res) {
  const { id, data } = req.body || {};
  if (!OBJECT_ID.test(String(id))) return bad(res, 'Invalid category id');
  if (!isCipher(data, 16 * 1024)) return bad(res, 'Invalid ciphertext');
  if (await VaultCategory.countDocuments({ userId: req.user.id }) >= 50) return bad(res, '50 custom categories maximum');
  if (await VaultCategory.exists({ _id: id })) return bad(res, 'Category id already in use', 409);
  await VaultCategory.create({ _id: id, userId: req.user.id, data: cipher(data) });
  res.status(201).json({ category: { id, data: cipher(data) } });
}

export async function updateCategory(req, res) {
  const { data } = req.body || {};
  if (!OBJECT_ID.test(req.params.id) || !isCipher(data, 16 * 1024)) return bad(res, 'Invalid category');
  const cat = await VaultCategory.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { data: cipher(data) } }, { returnDocument: 'after' });
  if (!cat) return bad(res, 'Category not found', 404);
  res.json({ category: { id: String(cat._id), data: cipher(cat.data) } });
}

export async function deleteCategory(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid category id');
  const cat = await VaultCategory.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!cat) return bad(res, 'Category not found', 404);
  // Items keep their contents and move to Secure note
  const moved = await VaultItem.updateMany({ userId: req.user.id, categoryId: req.params.id }, { $set: { categoryId: 'note' } });
  res.json({ ok: true, moved: moved.modifiedCount });
}

// ── Sharing (end-to-end, read-only for the recipient) ─────────────────────────

export async function recipientKey(req, res) {
  const username = String(req.params.username || '');
  if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) return bad(res, 'Invalid username');
  if (username === req.user.username) return bad(res, "You can't share with yourself");
  const user = await User.findOne({ username, totpVerified: true }).select('_id username').lean();
  if (!user) return bad(res, 'No Notespace user with that name', 404);
  const meta = await VaultMeta.findOne({ userId: user._id }).select('ecdhPublicKey').lean();
  if (!meta) return res.status(409).json({ error: `${username} needs to set up their vault before you can share with them`, noVault: true });
  res.json({ username: user.username, publicKey: meta.ecdhPublicKey });
}

export async function listItemShares(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  const shares = await VaultShare.find({ itemId: req.params.id, ownerId: req.user.id }).lean();
  res.json({
    shares: shares.map(s => ({
      id: String(s._id), recipientUsername: s.recipientUsername, recipientKey: s.recipientKey, createdAt: s.createdAt,
    })),
  });
}

export async function createShare(req, res) {
  const { recipientUsername, recipientKey: rKey, wrappedItemKey, ephemeralPub } = req.body || {};
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid item id');
  if (!isCipher(wrappedItemKey) || !isB64(ephemeralPub, 200) || !isB64(rKey, 200)) return bad(res, 'Invalid share');
  const item = await VaultItem.findOne({ _id: req.params.id, userId: req.user.id, deletedAt: null }).select('_id').lean();
  if (!item) return bad(res, 'Item not found', 404);
  const recipient = await User.findOne({ username: String(recipientUsername), totpVerified: true }).select('_id username').lean();
  if (!recipient) return bad(res, 'No Notespace user with that name', 404);
  if (String(recipient._id) === String(req.user.id)) return bad(res, "You can't share with yourself");
  const rMeta = await VaultMeta.findOne({ userId: recipient._id }).select('ecdhPublicKey').lean();
  // The owner wrapped for the key they verified; refuse if it has changed since they looked it up
  if (!rMeta || rMeta.ecdhPublicKey !== rKey) return bad(res, "The recipient's vault key changed. Look them up again.", 409);
  if (await VaultShare.countDocuments({ itemId: item._id }) >= 20) return bad(res, '20 recipients per item maximum');

  try {
    const share = await VaultShare.create({
      itemId: item._id, ownerId: req.user.id, ownerUsername: req.user.username,
      recipientId: recipient._id, recipientUsername: recipient.username, recipientKey: rKey,
      wrappedItemKey: cipher(wrappedItemKey), ephemeralPub,
    });
    res.status(201).json({ share: { id: String(share._id), recipientUsername: recipient.username, recipientKey: rKey, createdAt: share.createdAt } });
  } catch (err) {
    if (err.code === 11000) return bad(res, `Already shared with ${recipient.username}`, 409);
    throw err;
  }
}

export async function revokeShare(req, res) {
  if (!OBJECT_ID.test(req.params.shareId)) return bad(res, 'Invalid share id');
  const share = await VaultShare.findOneAndDelete({ _id: req.params.shareId, ownerId: req.user.id });
  if (!share) return bad(res, 'Share not found', 404);
  res.json({ ok: true, itemId: String(share.itemId) });
}

export async function sharedWithMe(req, res) {
  const shares = await VaultShare.find({ recipientId: req.user.id }).lean();
  const items = await VaultItem.find({ _id: { $in: shares.map(s => s.itemId) }, deletedAt: null }).lean();
  const byId = new Map(items.map(i => [String(i._id), i]));
  res.json({
    shared: shares.filter(s => byId.has(String(s.itemId))).map(s => {
      const i = byId.get(String(s.itemId));
      return {
        shareId: String(s._id),
        itemId: String(i._id),
        ownerUsername: s.ownerUsername,
        recipientKey: s.recipientKey,
        categoryId: BUILTIN_CATEGORIES.includes(i.categoryId) ? i.categoryId : 'note',
        wrappedItemKey: cipher(s.wrappedItemKey),
        ephemeralPub: s.ephemeralPub,
        data: cipher(i.data),
        version: i.version,
        updatedAt: i.updatedAt,
        sharedAt: s.createdAt,
      };
    }),
  });
}

export async function leaveShare(req, res) {
  if (!OBJECT_ID.test(req.params.shareId)) return bad(res, 'Invalid share id');
  const share = await VaultShare.findOneAndDelete({ _id: req.params.shareId, recipientId: req.user.id });
  if (!share) return bad(res, 'Share not found', 404);
  res.json({ ok: true });
}
