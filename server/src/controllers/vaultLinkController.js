import VaultMeta from '../models/VaultMeta.js';
import VaultLink from '../models/VaultLink.js';
import { issueTicket } from '../lib/vaultTicket.js';
import { getRequestToken, hashToken } from '../lib/session.js';

// "Unlock this PC with my phone": the PC shows a QR, the phone (already unlocked, fresh fingerprint) answers
// with the Vault Key encrypted to the PC's one-time public key. The server checks who may do what and relays
// the ciphertext; it never holds anything it could decrypt.

const LINK_TTL_MS = 2 * 60 * 1000;
const FRESH_STEPUP_MS = 2 * 60 * 1000;
const OBJECT_ID = /^[a-f0-9]{24}$/;
const B64 = /^[A-Za-z0-9+/=_-]+$/;
const isB64 = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && B64.test(s);
const bad = (res, error, status = 400) => res.status(status).json({ error });
const sessionHashOf = (req) => hashToken(getRequestToken(req) || '');

// PC: start a request (needs a login session, not the vault ticket)
export async function startLink(req, res) {
  if (!(await VaultMeta.exists({ userId: req.user.id }))) return bad(res, 'Vault is not set up', 404);
  const open = await VaultLink.countDocuments({ userId: req.user.id, status: 'pending', expiresAt: { $gt: new Date() } });
  if (open >= 5) return bad(res, 'Too many open QR requests. Wait a minute and try again.', 429);
  const link = await VaultLink.create({
    userId: req.user.id,
    sessionHash: sessionHashOf(req),
    deviceName: String(req.body?.deviceName || 'Computer').slice(0, 80),
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
  });
  res.status(201).json({ id: String(link._id), expiresAt: link.expiresAt });
}

// PC: poll. On approval, hands over the phone's answer once, and opens gate 1 for this PC session.
export async function pollLink(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid request');
  const link = await VaultLink.findOne({ _id: req.params.id, userId: req.user.id, sessionHash: sessionHashOf(req) });
  if (!link || link.expiresAt < new Date()) return res.json({ status: 'expired' });
  if (link.status !== 'approved') return res.json({ status: link.status });

  // Single use: claim it atomically so two polls can't both collect
  const claimed = await VaultLink.findOneAndUpdate(
    { _id: link._id, status: 'approved' },
    { $set: { status: 'consumed', wrapped: null, phonePub: null } },
  );
  if (!claimed) return res.json({ status: 'consumed' });
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  issueTicket(req, res, meta);
  await meta.save();
  res.json({ status: 'approved', phonePub: claimed.phonePub, wrapped: { iv: claimed.wrapped.iv, ct: claimed.wrapped.ct }, approvedFrom: claimed.approvedFrom });
}

export async function cancelLink(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid request');
  await VaultLink.updateOne({ _id: req.params.id, userId: req.user.id, sessionHash: sessionHashOf(req), status: 'pending' }, { $set: { status: 'cancelled' } });
  res.json({ ok: true });
}

// Phone (vault ticket required): what is asking? Only the same account can see it.
export async function linkInfo(req, res) {
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid request');
  const link = await VaultLink.findOne({ _id: req.params.id, userId: req.user.id });
  if (!link || link.expiresAt < new Date()) return bad(res, 'This QR code has expired. Show a new one on the computer.', 410);
  if (link.status !== 'pending') return bad(res, 'This QR code was already used. Show a new one on the computer.', 410);
  res.json({ deviceName: link.deviceName, status: link.status, createdAt: link.createdAt, expiresAt: link.expiresAt });
}

// Phone: approve with the encrypted Vault Key. Requires a step-up (fingerprint or code) in the last 2 minutes.
export async function approveLink(req, res) {
  const { phonePub, wrapped, deviceName } = req.body || {};
  if (!OBJECT_ID.test(req.params.id)) return bad(res, 'Invalid request');
  if (!isB64(phonePub, 200) || !wrapped || !isB64(wrapped.iv, 64) || !isB64(wrapped.ct, 512)) return bad(res, 'Invalid approval');
  const issuedAt = req.vaultTicket.issuedAt?.getTime() || 0;
  if (Date.now() - issuedAt > FRESH_STEPUP_MS) return res.status(403).json({ error: 'Confirm with your fingerprint again', needsStepUp: true });
  const link = await VaultLink.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'approved', phonePub, wrapped: { iv: wrapped.iv, ct: wrapped.ct }, approvedFrom: String(deviceName || 'Phone').slice(0, 80) } },
    { returnDocument: 'after' }
  );
  if (!link) return bad(res, 'This QR code has expired or was already used. Show a new one on the computer.', 410);
  res.json({ ok: true, deviceName: link.deviceName });
}
