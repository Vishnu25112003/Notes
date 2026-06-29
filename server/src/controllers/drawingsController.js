import Drawing from '../models/Drawing.js';
import cloudinary from '../lib/cloudinary.js';

export async function createDrawing(req, res) {
  const { pageId, sceneData } = req.body;
  const drawing = await Drawing.create({ pageId: pageId || null, sceneData: sceneData || {} });
  res.status(201).json(drawing);
}

export async function getDrawing(req, res) {
  const drawing = await Drawing.findById(req.params.id);
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json(drawing);
}

export async function updateDrawing(req, res) {
  const drawing = await Drawing.findByIdAndUpdate(
    req.params.id,
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

  const drawing = await Drawing.findByIdAndUpdate(
    req.params.id,
    { exportUrl: result.secure_url },
    { new: true }
  );
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json(drawing);
}

export async function deleteDrawing(req, res) {
  await Drawing.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}
