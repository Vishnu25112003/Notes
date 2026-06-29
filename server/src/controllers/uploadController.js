import cloudinary from '../lib/cloudinary.js';
import { Readable } from 'stream';

export async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'notes-images' },
    (error, result) => {
      if (error) return res.status(500).json({ error: error.message });
      res.json({ url: result.secure_url });
    }
  );

  Readable.from(req.file.buffer).pipe(stream);
}
