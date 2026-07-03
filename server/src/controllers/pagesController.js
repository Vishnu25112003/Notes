import Page from '../models/Page.js';
import Section from '../models/Section.js';
import Drawing from '../models/Drawing.js';
import { flattenTipTap } from '../lib/flattenTipTap.js';

export async function getPageTree(req, res) {
  const pages = await Page.find({ sectionId: req.params.id, userId: req.user.id }).sort({ order: 1 });
  res.json(pages);
}

export async function createPage(req, res) {
  const { sectionId, parentId, title } = req.body;
  const section = await Section.findOne({ _id: sectionId, userId: req.user.id }).select('_id');
  if (!section) return res.status(404).json({ error: 'Section not found' });

  const siblingsCount = await Page.countDocuments({ sectionId, parentId: parentId || null, userId: req.user.id });
  const page = await Page.create({
    userId: req.user.id,
    sectionId,
    parentId: parentId || null,
    title: title || 'Untitled Page',
    order: siblingsCount,
  });
  res.status(201).json(page);
}

export async function getPage(req, res) {
  const page = await Page.findOne({ _id: req.params.id, userId: req.user.id });
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
}

export async function updatePage(req, res) {
  const { title, content } = req.body;
  const update = {};
  if (title !== undefined) update.title = title;
  if (content !== undefined) {
    update.content = content;
    update.searchText = flattenTipTap(content);
  }
  const page = await Page.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    update,
    { new: true }
  );
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
}

async function cascadeDeletePage(pageId, userId) {
  const children = await Page.find({ parentId: pageId, userId }).select('_id');
  for (const child of children) await cascadeDeletePage(child._id, userId);
  await Drawing.deleteMany({ pageId, userId });
  await Page.findOneAndDelete({ _id: pageId, userId });
}

export async function deletePage(req, res) {
  await cascadeDeletePage(req.params.id, req.user.id);
  res.json({ ok: true });
}

export async function movePage(req, res) {
  const { parentId, order } = req.body;
  const page = await Page.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { parentId: parentId ?? null, order: order ?? 0 },
    { new: true }
  );
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
}
