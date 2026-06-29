import Section from '../models/Section.js';
import Page from '../models/Page.js';
import Drawing from '../models/Drawing.js';

export async function listSections(req, res) {
  const sections = await Section.find().sort({ updatedAt: -1 });
  res.json(sections);
}

export async function createSection(req, res) {
  const { title } = req.body;
  const section = await Section.create({ title: title || 'Untitled Section' });
  res.status(201).json(section);
}

export async function updateSection(req, res) {
  const section = await Section.findByIdAndUpdate(
    req.params.id,
    { title: req.body.title },
    { new: true }
  );
  if (!section) return res.status(404).json({ error: 'Not found' });
  res.json(section);
}

export async function deleteSection(req, res) {
  const pages = await Page.find({ sectionId: req.params.id }).select('_id');
  const pageIds = pages.map(p => p._id);
  await Drawing.deleteMany({ pageId: { $in: pageIds } });
  await Page.deleteMany({ sectionId: req.params.id });
  await Section.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}
