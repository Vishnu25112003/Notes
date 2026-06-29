import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes, createNote, deleteNote } from '../api/notes.js';
import Loader from '../components/common/Loader.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { flattenTipTap } from '../lib/flattenTipTap.js';

const GRID_BG = {
  backgroundColor: '#0a0a0c',
  backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)',
  backgroundSize: '32px 32px',
};

const DOT_COLORS = ['#7c6cff', '#5be3a0', '#f5a524', '#7c6cff', '#5be3a0'];

function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins || 1}M AGO`;
  if (hrs < 24) return `${hrs}H AGO`;
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days} DAYS`;
  if (days < 14) return 'LAST WEEK';
  return `${Math.floor(days / 7)}W AGO`;
}

function contentMeta(content) {
  if (!content) return 'EMPTY';
  const text = flattenTipTap(content);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  if (words > 0) return `${words} WORDS`;
  return 'EMPTY';
}

const BackArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

export default function SimpleList() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try { setNotes(await getNotes()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const note = await createNote({ title: 'Untitled', content: {} });
    navigate(`/simple/${note._id}`);
  };

  const handleDelete = async () => {
    await deleteNote(deleteTarget._id);
    setDeleteTarget(null);
    load();
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen flex flex-col" style={GRID_BG}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#7c6cff,#4b3fd6 55%,transparent)' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: '#7a7a85', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <BackArrow /> HOME
          </button>
          <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.1)' }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: '#f4f4f6' }}>Simple Notes</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', border: '1px solid rgba(124,108,255,.4)', borderRadius: 20, padding: '3px 9px' }}>
            {String(notes.length).padStart(2, '0')} NOTES
          </span>
        </div>
        <button
          onClick={handleCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#0a0a0c', background: '#7c6cff', border: 'none', borderRadius: 7, padding: '9px 15px', fontWeight: 600, cursor: 'pointer' }}
        >
          <PlusIcon /> NEW NOTE
        </button>
      </div>

      {/* Grid */}
      <div style={{ padding: '24px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {notes.map((note, i) => (
          <div
            key={note._id}
            onClick={() => navigate(`/simple/${note._id}`)}
            style={{
              border: '1px solid #2a2a31',
              borderRadius: 9,
              padding: 18,
              background: 'rgba(255,255,255,.014)',
              height: 180,
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              position: 'relative',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.4)'; e.currentTarget.style.background = 'rgba(124,108,255,.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.014)'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT_COLORS[i % DOT_COLORS.length], display: 'block' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>{relativeTime(note.updatedAt)}</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: '#ededf0', marginTop: 14 }}>
              {note.title || 'Untitled'}
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: '#7c7c86', marginTop: 7, lineHeight: 1.5, flex: 1, overflow: 'hidden' }}>
              {flattenTipTap(note.content)?.slice(0, 80) || <span style={{ fontStyle: 'italic' }}>No content</span>}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f', letterSpacing: '0.06em' }}>
              {contentMeta(note.content)}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setDeleteTarget(note); }}
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'none', border: 'none', color: '#55555f', cursor: 'pointer',
                fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
                opacity: 0, transition: 'opacity 0.15s',
              }}
              className="delete-btn"
              onMouseEnter={e => e.currentTarget.style.color = '#ec5d8a'}
              onMouseLeave={e => e.currentTarget.style.color = '#55555f'}
            >×</button>
          </div>
        ))}

        {/* New note placeholder card */}
        <div
          onClick={handleCreate}
          style={{
            border: '1px dashed #34343c',
            borderRadius: 9,
            height: 180,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#34343c'}
        >
          <span style={{ color: '#7c6cff' }}><PlusIcon size={22} /></span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: '#7a7a85' }}>NEW NOTE</span>
        </div>
      </div>

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#9a9aa5', marginBottom: 8 }}>No notes yet</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.04em', color: '#55555f' }}>PRESS + TO CREATE YOUR FIRST NOTE</div>
        </div>
      )}

      <style>{`.delete-btn { opacity: 0; } div:hover > .delete-btn { opacity: 1; }`}</style>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete note?"
          message={`Delete "${deleteTarget.title}"?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
