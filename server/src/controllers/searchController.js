import SimpleNote from '../models/SimpleNote.js';
import Page from '../models/Page.js';

export async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const [notes, pages] = await Promise.all([
    SimpleNote.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .select('title searchText'),
    Page.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .select('title searchText sectionId'),
  ]);

  const results = [
    ...notes.map(n => ({
      type: 'note',
      id: n._id,
      title: n.title,
      snippet: n.searchText?.slice(0, 120) || '',
    })),
    ...pages.map(p => ({
      type: 'page',
      id: p._id,
      title: p.title,
      snippet: p.searchText?.slice(0, 120) || '',
      sectionId: p.sectionId,
    })),
  ];

  res.json(results);
}
