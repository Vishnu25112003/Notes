import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNote, updateNote } from '../api/notes.js';
import Editor from '../components/editor/Editor.jsx';
import DrawingCanvas from '../components/drawing/DrawingCanvas.jsx';
import Loader from '../components/common/Loader.jsx';
import SaveStatus from '../components/common/SaveStatus.jsx';
import { useAutosave } from '../hooks/useAutosave.js';

const BackArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

export default function SimpleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [drawingId, setDrawingId] = useState(null);
  const [loading, setLoading] = useState(true);
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
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0c' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#7c6cff,#4b3fd6 55%,transparent)' }} />

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <button
          onClick={() => navigate('/simple')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: '#7a7a85', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <BackArrow /> NOTES
        </button>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 780, width: '100%', margin: '0 auto', padding: '34px 56px 0' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#55555f', marginBottom: 10 }}>
          UNTITLED · NOTE
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f4f4f6',
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
    </div>
  );
}
