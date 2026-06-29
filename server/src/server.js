import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { connectDB } from './db.js';
import notesRouter from './routes/notes.js';
import sectionsRouter from './routes/sections.js';
import pagesRouter from './routes/pages.js';
import drawingsRouter from './routes/drawings.js';
import uploadRouter from './routes/upload.js';
import searchRouter from './routes/search.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, '../../client/dist');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin / curl / Postman (no origin header)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/notes', notesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/drawings', drawingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/search', searchRouter);

app.use(errorHandler);

// Serve React frontend in production
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
