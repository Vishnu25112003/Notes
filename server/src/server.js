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
import shareRouter from './routes/share.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, '../../client/dist');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''));

app.use(cors({
  origin: (origin, cb) => {
    const normalized = origin?.replace(/\/$/, '');
    if (!origin || allowedOrigins.includes(normalized)) return cb(null, true);
    console.warn(`CORS blocked: ${origin} | allowed: ${allowedOrigins.join(', ')}`);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

app.use('/api/notes',    requireAuth, notesRouter);
app.use('/api/sections', requireAuth, sectionsRouter);
app.use('/api/pages',    requireAuth, pagesRouter);
app.use('/api/drawings', requireAuth, drawingsRouter);
app.use('/api/upload',   requireAuth, uploadRouter);
app.use('/api/search',   requireAuth, searchRouter);
app.use('/api/share',    requireAuth, shareRouter);

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
