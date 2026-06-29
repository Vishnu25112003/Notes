import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import notesRouter from './routes/notes.js';
import sectionsRouter from './routes/sections.js';
import pagesRouter from './routes/pages.js';
import drawingsRouter from './routes/drawings.js';
import uploadRouter from './routes/upload.js';
import searchRouter from './routes/search.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/notes', notesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/drawings', drawingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/search', searchRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
