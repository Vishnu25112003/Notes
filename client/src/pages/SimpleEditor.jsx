import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNote, updateNote } from '../api/notes.js';
import Editor from '../components/editor/Editor.jsx';
import DrawingCanvas from '../components/drawing/DrawingCanvas.jsx';
import Loader from '../components/common/Loader.jsx';
import SaveStatus from '../components/common/SaveStatus.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';
import ExportModal from '../components/common/ExportModal.jsx';
import { useAutosave } from '../hooks/useAutosave.js';

const BackArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M7 10l5 5 5-5M12 15V3"/>
  </svg>
);

export default function SimpleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [drawingId, setDrawingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    getNote(id).then(n => {
      setTitle(n.title);
      setContent(n.content);
      setLoading(false);
    }).catch(() => navigate('/simple'));
  }, [id]);

  const contentKey = JSON.stringify(content);
  const saveStatus = useAutosave(
    () => updateNote(id, { title: titleRef.current, content: contentRef.current }),
    [title, contentKey]
  );

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border-faint)' }}>
        <button
          onClick={() => navigate('/simple')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <BackArrow /> NOTES
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setExporting(true)}
            title="Export & share"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.07em', color: 'var(--text-mid)', background: 'var(--card-subtle)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 11px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
          >
            <ExportIcon /> EXPORT
          </button>
          <ThemeToggle />
          <SaveStatus status={saveStatus} />
        </div>
      </div>

      <style>{`
        .simple-editor-area { padding: 34px 56px 0; }
        .simple-editor-title { font-size: 34px; }
        @media (max-width: 767px) {
          .simple-editor-area { padding: 20px 16px 0; }
          .simple-editor-title { font-size: 26px; }
        }
      `}</style>

      {/* Editor area */}
      <div className="simple-editor-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 780, width: '100%', margin: '0 auto' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-label)', marginBottom: 10 }}>
          UNTITLED · NOTE
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="simple-editor-title"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            marginBottom: 8,
          }}
        />
        <Editor
          content={content}
          onChange={setContent}
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

      {exporting && (
        <ExportModal title={title} content={content} onClose={() => setExporting(false)} />
      )}
    </div>
  );
}
