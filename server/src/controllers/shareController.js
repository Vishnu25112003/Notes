import mongoose from 'mongoose';
import SimpleNote from '../models/SimpleNote.js';
import Page from '../models/Page.js';
import Section from '../models/Section.js';
import User from '../models/User.js';
import { flattenTipTap } from '../lib/flattenTipTap.js';

function getModel(type) {
  if (type === 'note') return SimpleNote;
  if (type === 'page') return Page;
  if (type === 'section') return Section;
  return null;
}

// Sections are containers — they have no content of their own to view/edit/clone directly
function hasContent(type) {
  return type === 'note' || type === 'page';
}

// A page is accessible either through its own share or through its section's share.
// Returns the share that granted access (so public opens can be persisted there), or null.
async function effectivePageAccess(page, userId) {
  const pageShare = normalizeShare(page);
  if (hasAccess(pageShare, userId)) {
    return { share: pageShare, doc: page };
  }
  const section = await Section.findById(page.sectionId);
  if (section) {
    const sectionShare = normalizeShare(section);
    if (hasAccess(sectionShare, userId)) {
      return { share: sectionShare, doc: section };
    }
  }
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
  const [notes, pages, sections] = await Promise.all([
    SimpleNote.find(query).select('title userId share updatedAt').populate('userId', 'username'),
    Page.find(query).select('title userId share updatedAt').populate('userId', 'username'),
    Section.find(query).select('title userId share updatedAt').populate('userId', 'username'),
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
    ...sections.map(s => toEntry(s, 'section')),
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
  const [a, b, c] = await Promise.all([countFor(SimpleNote), countFor(Page), countFor(Section)]);
  res.json({ count: a + b + c });
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

  // A page may be reached through its own share or the share of its section
  if (type === 'page') {
    const access = await effectivePageAccess(doc, req.user.id);
    if (!access) {
      const requestPending = normalizeShare(doc).requests.some(r => String(r.userId) === String(req.user.id));
      return res.json({ status: 'denied', requestPending });
    }
    if (upsertSharedWith(access.share, req.user.id, req.user.username, 'public')) {
      await access.doc.save();
    }
    const owner = await User.findById(doc.userId).select('username');
    return res.json({
      status: 'ok',
      kind: 'doc',
      note: { id: doc._id, type, title: doc.title, content: doc.content, updatedAt: doc.updatedAt },
      owner: owner?.username || 'unknown',
      permission: access.share.permission,
      allowClone: access.share.allowClone,
      visibility: access.share.visibility,
    });
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

  // Sections resolve to a browsable list of their pages rather than content
  if (type === 'section') {
    const pages = await Page.find({ sectionId: doc._id })
      .select('title parentId order updatedAt')
      .sort({ order: 1 });
    return res.json({
      status: 'ok',
      kind: 'section',
      section: { id: doc._id, title: doc.title, updatedAt: doc.updatedAt },
      pages: pages.map(p => ({
        id: p._id,
        title: p.title,
        parentId: p.parentId,
        order: p.order,
        updatedAt: p.updatedAt,
      })),
      owner: owner?.username || 'unknown',
      permission: share.permission,
      allowClone: share.allowClone,
      visibility: share.visibility,
    });
  }

  res.json({
    status: 'ok',
    kind: 'doc',
    note: { id: doc._id, type, title: doc.title, content: doc.content, updatedAt: doc.updatedAt },
    owner: owner?.username || 'unknown',
    permission: share.permission,
    allowClone: share.allowClone,
    visibility: share.visibility,
  });
}

export async function updateSharedContent(req, res) {
  const { type, id } = req.params;
  if (!hasContent(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const owner = isOwner(doc, req.user.id);
  if (!owner) {
    // Pages inherit edit access from their section share; notes use their own
    const access = type === 'page'
      ? await effectivePageAccess(doc, req.user.id)
      : (hasAccess(normalizeShare(doc), req.user.id) ? { share: normalizeShare(doc) } : null);
    if (!access || access.share.permission !== 'edit') {
      return res.status(403).json({ error: 'No edit access' });
    }
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

export async function createSectionPage(req, res) {
  const { type, id } = req.params;
  if (type !== 'section') return res.status(400).json({ error: 'Pages can only be created inside a section' });
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Not found' });
  const section = await Section.findById(id);
  if (!section) return res.status(404).json({ error: 'Not found' });

  const owner = isOwner(section, req.user.id);
  if (!owner) {
    const share = normalizeShare(section);
    if (!hasAccess(share, req.user.id) || share.permission !== 'edit') {
      return res.status(403).json({ error: 'No edit access' });
    }
  }

  const { title, parentId } = req.body;
  // A provided parent must be a page of this same section
  if (parentId) {
    if (!mongoose.isValidObjectId(parentId)) return res.status(400).json({ error: 'Invalid parent page' });
    const parent = await Page.findOne({ _id: parentId, sectionId: section._id }).select('_id');
    if (!parent) return res.status(400).json({ error: 'Invalid parent page' });
  }

  // Pages of a shared section belong to the section owner so the tree stays unified
  // and access keeps cascading from the section's share.
  const siblingsCount = await Page.countDocuments({
    sectionId: section._id,
    parentId: parentId || null,
    userId: section.userId,
  });
  const page = await Page.create({
    userId: section.userId,
    sectionId: section._id,
    parentId: parentId || null,
    title: title || 'Untitled Page',
    order: siblingsCount,
  });
  res.status(201).json({
    id: page._id,
    title: page.title,
    parentId: page.parentId,
    order: page.order,
    updatedAt: page.updatedAt,
  });
}

export async function requestAccess(req, res) {
  const { type, id } = req.params;
  if (!getModel(type)) return res.status(400).json({ error: 'Invalid type' });
  const doc = await loadDoc(type, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (isOwner(doc, req.user.id)) return res.status(400).json({ error: 'You own this note' });

  // A page granted through its section needs no separate request
  if (type === 'page' && await effectivePageAccess(doc, req.user.id)) {
    return res.json({ status: 'already-has-access' });
  }

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

  const owner = isOwner(doc, req.user.id);

  // Resolve the share that authorizes cloning (a page may inherit it from its section)
  let share;
  if (type === 'page' && !owner) {
    const access = await effectivePageAccess(doc, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    share = access.share;
  } else {
    share = normalizeShare(doc);
    if (!owner && !hasAccess(share, req.user.id)) return res.status(403).json({ error: 'No access' });
  }
  if (!share.allowClone && !owner) return res.status(403).json({ error: 'Cloning disabled by owner' });

  // Cloning a section copies it and every page into the receiver's account
  if (type === 'section') {
    const section = await Section.create({ userId: req.user.id, title: doc.title });
    const pages = await Page.find({ sectionId: doc._id }).sort({ order: 1 });
    const idMap = new Map(); // old page id -> new page id

    // Pass 1: create every page (parent links wired up afterwards)
    for (const p of pages) {
      const content = sanitizeContentForClone(p.content);
      const created = await Page.create({
        userId: req.user.id,
        sectionId: section._id,
        parentId: null,
        title: p.title,
        content,
        order: p.order,
        searchText: flattenTipTap(content),
      });
      idMap.set(String(p._id), created._id);
    }
    // Pass 2: remap parentId now that all clones exist, preserving the tree
    await Promise.all(
      pages
        .filter(p => p.parentId && idMap.has(String(p.parentId)))
        .map(p => Page.updateOne(
          { _id: idMap.get(String(p._id)) },
          { parentId: idMap.get(String(p.parentId)) }
        ))
    );
    return res.status(201).json({ id: section._id });
  }

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
