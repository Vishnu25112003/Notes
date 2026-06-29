import { useState, useEffect, useRef } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { getPage, updatePage } from '../api/pages.js';
import Editor from '../components/editor/Editor.jsx';
import DrawingCanvas from '../components/drawing/DrawingCanvas.jsx';
import Breadcrumbs from '../components/tree/Breadcrumbs.jsx';
import Loader from '../components/common/Loader.jsx';
import SaveStatus from '../components/common/SaveStatus.jsx';
import { useAutosave } from '../hooks/useAutosave.js';

function getDepth(pages, pageId) {
  let depth = 0;
  let current = pages.find(p => String(p._id) === String(pageId));
  while (current?.parentId) {
    depth++;
    current = pages.find(p => String(p._id) === String(current.parentId));
  }
  return depth;
}

export default function PageEditor() {
  const { pageId } = useParams();
  const { pages, section, onRefresh } = useOutletContext();
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [drawingId, setDrawingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    setLoading(true);
    getPage(pageId).then(p => {
      setPage(p);
      setTitle(p.title);
      setContent(p.content);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pageId]);

  const contentKey = JSON.stringify(content);
  const saveStatus = useAutosave(
    async () => {
      await updatePage(pageId, { title: titleRef.current, content: contentRef.current });
      onRefresh();
    },
    [title, contentKey]
  );

  if (loading) return <Loader />;
  if (!page) return <div style={{ padding: 32, color: '#55555f', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>Page not found</div>;

  const depth = getDepth(pages, pageId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <Breadcrumbs section={section} pages={pages} currentPageId={pageId} />
        <SaveStatus status={saveStatus} />
      </div>

      {/* Editor content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 44px 0' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#55555f', marginBottom: 9 }}>
          PAGE · DEPTH {depth}
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Page title"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f4f4f6',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            display: 'block',
            marginBottom: 4,
          }}
        />
        <Editor
          key={pageId}
          content={content}
          onChange={setContent}
          pageId={pageId}
          onOpenDrawing={setDrawingId}
          placeholder="Start writing…"
        />
      </div>

      {drawingId && (
        <DrawingCanvas
          drawingId={drawingId}
          onClose={() => setDrawingId(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
