import mongoose from 'mongoose';
import SimpleNote from '../models/SimpleNote.js';
import Page from '../models/Page.js';
import User from '../models/User.js';
import { flattenTipTap } from '../lib/flattenTipTap.js';

function getModel(type) {
  if (type === 'note') return SimpleNote;
  if (type === 'page') return Page;
  return null;
}

async function loadDoc(type, id) {
  const Model = getModel(type);
  if (!Model || !mongoose.isValidObjectId(id)) return null;
  return Model.findById(id);
}

// Docs created before the share field existed may lack the subdoc
function normalizeShare(doc) {
  if (!doc.share) {
    doc.share = { visibility: 'private', permission: 'view', allowClone: false, sharedWith: [], requests: [] };
  }
  return doc.share;
}

function isOwner(doc, userId) {
  return String(doc.userId) === String(userId);
}

// via:'public' entries only keep the note listed — they grant nothing when private
function hasAccess(share, userId) {
  if (share.visibility === 'public') return true;
  return share.sharedWith.some(
    e => String(e.userId) === String(userId) && (e.via === 'granted' || e.via === 'approved')
  );
}

// Adds or upgrades an entry; never downgrades granted/approved to public
function upsertSharedWith(share, userId, username, via) {
  const existing = share.sharedWith.find(e => String(e.userId) === String(userId));
  if (existing) {
    if (via !== 'public' || existing.via === 'public') existing.via = via;
    return false;
  }
  share.sharedWith.push({ userId, username, via, addedAt: new Date() });
  return true;
}

function settingsPayload(doc) {
  const share = normalizeShare(doc);
  return {
    visibility: share.visibility,
    permission: share.permission,
    allowClone: share.allowClone,
    sharedWith: share.sharedWith.map(e => ({ userId: e.userId, username: e.username, via: e.via, addedAt: e.addedAt })),
    requests: share.requests.map(r => ({ userId: r.userId, username: r.username, requestedAt: r.requestedAt })),
  };
}

// Clones must not reference Drawing records — exported drawings become plain images
function sanitizeContentForClone(content) {
  function walk(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'drawingBlock') {
      if (node.attrs?.exportUrl) {
        return {
          type: 'imageBlock',
          attrs: { src: node.attrs.exportUrl, alt: 'Drawing', width: node.attrs.width || '100%' },
        };
      }
      return null;
    }
    const out = { ...node };
    if (Array.isArray(node.content)) {
      out.content = node.content.map(walk).filter(Boolean);
    }
    return out;
  }
  return walk(content) || {};
}

async function loadOwnedDoc(req, res) {
  const doc = await loadDoc(req.params.type, req.params.id);
  if (!getModel(req.params.type)) {
    res.status(400).json({ error: 'Invalid type' });
    return null;
  }
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (!isOwner(doc, req.user.id)) {
    res.status(403).json({ error: 'Only the owner can manage sharing' });
    return null;
  }
  return doc;
}

// ---------- Receiver-facing ----------

export async function listSharedWithMe(req, res) {
  const query = { 'share.sharedWith.userId': req.user.id };
  const [notes, pages] = await Promise.all([
    SimpleNote.find(query).select('title userId share updatedAt').populate('userId', 'username'),
    Page.find(query).select('title userId share updatedAt').populate('userId', 'username'),
  ]);
  const toEntry = (doc, type) => {
    const share = normalizeShare(doc);
    const mine = share.sharedWith.find(e => String(e.userId) === String(req.user.id));
    return {
      type,
      id: doc._id,
      title: doc.title,
      ownerUsername: doc.userId?.username || 'unknown',
      permission: share.permission,
      visibility: share.visibility,
      via: mine?.via || 'public',
      accessible: share.visibility === 'public' || mine?.via === 'granted' || mine?.via === 'approved',
      updatedAt: doc.updatedAt,
    };
  };
  const items = [
    ...notes.map(n => toEntry(n, 'note')),
    ...pages.map(p => toEntry(p, 'page')),
  ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(items);
}

export async function pendingRequestCount(req, res) {
  const ownerId = new mongoose.Types.ObjectId(String(req.user.id));
  const countFor = (Model) =>
    Model.aggregate([
      { $match: { userId: ownerId, 'share.requests.0': { $exists: true } } },
      { $project: { n: { $size: '$share.requests' } } },
      { $group: { _id: null, total: { $sum: '$n' } } },
    ]).then(r => r[0]?.total || 0);
  const [a, b] = await Promise.all([countFor(SimpleNote), countFor(Page)]);
  res.json({ count: a + b });
}

export async function resolveShared(req, res) {
  const { type, id } = req.params;
  if (!getModel(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  if (isOwner(doc, req.user.id)) {
    const native = { type, id: doc._id };
    if (type === 'page') native.sectionId = doc.sectionId;
    return res.json({ status: 'owner', native });
  }

  const share = normalizeShare(doc);
  if (!hasAccess(share, req.user.id)) {
    const requestPending = share.requests.some(r => String(r.userId) === String(req.user.id));
    return res.json({ status: 'denied', requestPending });
  }

  // Persist public opens in the receiver's shared-with-me list
  if (upsertSharedWith(share, req.user.id, req.user.username, 'public')) {
    await doc.save();
  }

  const owner = await User.findById(doc.userId).select('username');
  res.json({
    status: 'ok',
    note: { id: doc._id, type, title: doc.title, content: doc.content, updatedAt: doc.updatedAt },
    owner: owner?.username || 'unknown',
    permission: share.permission,
    allowClone: share.allowClone,
    visibility: share.visibility,
  });
}

export async function updateSharedContent(req, res) {
  const { type, id } = req.params;
  if (!getModel(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const share = normalizeShare(doc);
  const owner = isOwner(doc, req.user.id);
  if (!owner && (!hasAccess(share, req.user.id) || share.permission !== 'edit')) {
    return res.status(403).json({ error: 'No edit access' });
  }

  const { title, content } = req.body;
  if (title !== undefined) doc.title = title;
  if (content !== undefined) {
    doc.content = content;
    doc.searchText = flattenTipTap(content);
    doc.markModified('content');
  }
  await doc.save();
  res.json({ ok: true, updatedAt: doc.updatedAt });
}

export async function requestAccess(req, res) {
  const { type, id } = req.params;
  if (!getModel(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (isOwner(doc, req.user.id)) return res.status(400).json({ error: 'You own this note' });

  const share = normalizeShare(doc);
  if (hasAccess(share, req.user.id)) return res.json({ status: 'already-has-access' });
  if (share.requests.some(r => String(r.userId) === String(req.user.id))) {
    return res.json({ status: 'pending' });
  }
  share.requests.push({ userId: req.user.id, username: req.user.username, requestedAt: new Date() });
  await doc.save();
  res.json({ status: 'pending' });
}

export async function cloneShared(req, res) {
  const { type, id } = req.params;
  if (!getModel(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const share = normalizeShare(doc);
  const owner = isOwner(doc, req.user.id);
  if (!owner && !hasAccess(share, req.user.id)) return res.status(403).json({ error: 'No access' });
  if (!share.allowClone && !owner) return res.status(403).json({ error: 'Cloning disabled by owner' });

  const content = sanitizeContentForClone(doc.content);
  const note = await SimpleNote.create({
    userId: req.user.id,
    title: doc.title,
    content,
    searchText: flattenTipTap(content),
  });
  res.status(201).json({ id: note._id });
}

// ---------- Owner-facing ----------

export async function getShareSettings(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  res.json(settingsPayload(doc));
}

export async function updateShareSettings(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  const share = normalizeShare(doc);
  const { visibility, permission, allowClone } = req.body;
  if (visibility !== undefined) {
    if (!['private', 'public'].includes(visibility)) return res.status(400).json({ error: 'Invalid visibility' });
    share.visibility = visibility;
  }
  if (permission !== undefined) {
    if (!['view', 'edit'].includes(permission)) return res.status(400).json({ error: 'Invalid permission' });
    share.permission = permission;
  }
  if (allowClone !== undefined) share.allowClone = !!allowClone;
  await doc.save();
  res.json(settingsPayload(doc));
}

export async function addShareUser(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  const username = String(req.body.username || '').trim();
  if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });

  const user = await User.findOne({ username, totpVerified: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (String(user._id) === String(req.user.id)) return res.status(400).json({ error: 'You own this note' });

  const share = normalizeShare(doc);
  upsertSharedWith(share, user._id, user.username, 'granted');
  share.requests = share.requests.filter(r => String(r.userId) !== String(user._id));
  await doc.save();
  res.json(settingsPayload(doc));
}

export async function removeShareUser(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  const share = normalizeShare(doc);
  share.sharedWith = share.sharedWith.filter(e => String(e.userId) !== String(req.params.userId));
  await doc.save();
  res.json(settingsPayload(doc));
}

export async function approveRequest(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  const share = normalizeShare(doc);
  const request = share.requests.find(r => String(r.userId) === String(req.params.userId));
  if (!request) return res.status(404).json({ error: 'Request not found' });
  upsertSharedWith(share, request.userId, request.username, 'approved');
  share.requests = share.requests.filter(r => String(r.userId) !== String(req.params.userId));
  await doc.save();
  res.json(settingsPayload(doc));
}

export async function denyRequest(req, res) {
  const doc = await loadOwnedDoc(req, res);
  if (!doc) return;
  const share = normalizeShare(doc);
  share.requests = share.requests.filter(r => String(r.userId) !== String(req.params.userId));
  await doc.save();
  res.json(settingsPayload(doc));
}
