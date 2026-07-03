import Drawing from '../models/Drawing.js';
import Page from '../models/Page.js';
import cloudinary from '../lib/cloudinary.js';

export async function createDrawing(req, res) {
  const { pageId, sceneData } = req.body;
  if (pageId) {
    const page = await Page.findOne({ _id: pageId, userId: req.user.id }).select('_id');
    if (!page) return res.status(404).json({ error: 'Page not found' });
  }
  const drawing = await Drawing.create({
    userId: req.user.id,
    pageId: pageId || null,
    sceneData: sceneData || {},
  });
  res.status(201).json(drawing);
}

export async function getDrawing(req, res) {
  const drawing = await Drawing.findOne({ _id: req.params.id, userId: req.user.id });
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json(drawing);
}

export async function updateDrawing(req, res) {
  const drawing = await Drawing.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { sceneData: req.body.sceneData },
    { new: true }
  );
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json(drawing);
}

export async function exportDrawing(req, res) {
  const { pngBase64 } = req.body;
  if (!pngBase64) return res.status(400).json({ error: 'pngBase64 required' });

  const result = await cloudinary.uploader.upload(`data:image/png;base64,${pngBase64}`, {
    folder: 'notes-drawings',
  });

  const drawing = await Drawing.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { exportUrl: result.secure_url },
    { new: true }
  );
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json(drawing);
}

export async function deleteDrawing(req, res) {
  await Drawing.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
}
