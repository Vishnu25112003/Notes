import SimpleNote from '../models/SimpleNote.js';
import { flattenTipTap } from '../lib/flattenTipTap.js';

export async function listNotes(req, res) {
  const notes = await SimpleNote.find({ userId: req.user.id })
    .sort({ updatedAt: -1 })
    .select('title updatedAt createdAt searchText');
  res.json(notes);
}

export async function createNote(req, res) {
  const { title, content } = req.body;
  const note = await SimpleNote.create({
    userId: req.user.id,
    title: title || 'Untitled',
    content: content || {},
    searchText: flattenTipTap(content),
  });
  res.status(201).json(note);
}

export async function getNote(req, res) {
  const note = await SimpleNote.findOne({ _id: req.params.id, userId: req.user.id });
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
}

export async function updateNote(req, res) {
  const { title, content } = req.body;
  const note = await SimpleNote.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { title, content, searchText: flattenTipTap(content) },
    { new: true }
  );
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
}

export async function deleteNote(req, res) {
  await SimpleNote.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
}
