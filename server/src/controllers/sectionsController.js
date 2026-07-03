import Section from '../models/Section.js';
import Page from '../models/Page.js';
import Drawing from '../models/Drawing.js';

export async function listSections(req, res) {
  const sections = await Section.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json(sections);
}

export async function createSection(req, res) {
  const { title } = req.body;
  const section = await Section.create({ userId: req.user.id, title: title || 'Untitled Section' });
  res.status(201).json(section);
}

export async function updateSection(req, res) {
  const section = await Section.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { title: req.body.title },
    { new: true }
  );
  if (!section) return res.status(404).json({ error: 'Not found' });
  res.json(section);
}

export async function deleteSection(req, res) {
  const section = await Section.findOne({ _id: req.params.id, userId: req.user.id }).select('_id');
  if (!section) return res.status(404).json({ error: 'Not found' });

  const pages = await Page.find({ sectionId: req.params.id, userId: req.user.id }).select('_id');
  const pageIds = pages.map(p => p._id);
  await Drawing.deleteMany({ pageId: { $in: pageIds }, userId: req.user.id });
  await Page.deleteMany({ sectionId: req.params.id, userId: req.user.id });
  await Section.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
}
