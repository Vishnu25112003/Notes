import Page from '../models/Page.js';
import Drawing from '../models/Drawing.js';
import { flattenTipTap } from '../lib/flattenTipTap.js';

export async function getPageTree(req, res) {
  const pages = await Page.find({ sectionId: req.params.id }).sort({ order: 1 });
  res.json(pages);
}

export async function createPage(req, res) {
  const { sectionId, parentId, title } = req.body;
  const siblingsCount = await Page.countDocuments({ sectionId, parentId: parentId || null });
  const page = await Page.create({
    sectionId,
    parentId: parentId || null,
    title: title || 'Untitled Page',
    order: siblingsCount,
  });
  res.status(201).json(page);
}

export async function getPage(req, res) {
  const page = await Page.findById(req.params.id);
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
  const page = await Page.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
}

async function cascadeDeletePage(pageId) {
  const children = await Page.find({ parentId: pageId }).select('_id');
  for (const child of children) await cascadeDeletePage(child._id);
  await Drawing.deleteMany({ pageId });
  await Page.findByIdAndDelete(pageId);
}

export async function deletePage(req, res) {
  await cascadeDeletePage(req.params.id);
  res.json({ ok: true });
}

export async function movePage(req, res) {
  const { parentId, order } = req.body;
  const page = await Page.findByIdAndUpdate(
    req.params.id,
    { parentId: parentId ?? null, order: order ?? 0 },
    { new: true }
  );
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
}
