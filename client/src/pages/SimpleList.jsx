import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes, createNote, deleteNote } from '../api/notes.js';
import Loader from '../components/common/Loader.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';

const GRID_BG = {
  backgroundColor: 'var(--bg)',
  backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
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

function contentMeta(searchText) {
  if (!searchText) return 'EMPTY';
  const words = searchText.trim().split(/\s+/).filter(Boolean).length;
  return words > 0 ? `${words} WORDS` : 'EMPTY';
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
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

      <style>{`
        .simplelist-header { padding: 18px 26px; }
        .simplelist-badge { display: inline; }
        .simplelist-grid { padding: 20px 26px; }
        @media (max-width: 640px) {
          .simplelist-header { padding: 14px 16px; }
          .simplelist-badge { display: none; }
          .simplelist-grid { padding: 16px 16px; }
        }
      `}</style>

      {/* Header */}
      <div className="simplelist-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <BackArrow /> HOME
          </button>
          <span style={{ width: 1, height: 18, background: 'var(--divider)', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Simple Notes</span>
          <span className="simplelist-badge" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--accent)', border: '1px solid rgba(124,108,255,.4)', borderRadius: 20, padding: '3px 9px', flexShrink: 0 }}>
            {String(notes.length).padStart(2, '0')} NOTES
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ThemeToggle />
          <button
            onClick={handleCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent-fg)', background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '9px 15px', fontWeight: 600, cursor: 'pointer' }}
          >
            <PlusIcon /> NEW NOTE
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="simplelist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%), 1fr))', gap: 14 }}>
        {notes.map((note, i) => (
          <div
            key={note._id}
            onClick={() => navigate(`/simple/${note._id}`)}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: 18,
              background: 'var(--card-subtle)',
              height: 180,
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              position: 'relative',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.4)'; e.currentTarget.style.background = 'rgba(124,108,255,.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-subtle)'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT_COLORS[i % DOT_COLORS.length], display: 'block' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-label)' }}>{relativeTime(note.updatedAt)}</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginTop: 14 }}>
              {note.title || 'Untitled'}
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: 'var(--text-dim)', marginTop: 7, lineHeight: 1.5, flex: 1, overflow: 'hidden' }}>
              {note.searchText?.slice(0, 80) || <span style={{ fontStyle: 'italic' }}>No content</span>}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-label)', letterSpacing: '0.06em' }}>
              {contentMeta(note.searchText)}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setDeleteTarget(note); }}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'var(--border-faint)', border: '1px solid var(--border-faint)',
                color: 'var(--text-dim)', cursor: 'pointer',
                fontSize: 15, lineHeight: 1, padding: '4px 7px', borderRadius: 5,
              }}
              className="delete-btn"
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-bg)'; e.currentTarget.style.borderColor = 'var(--error-border)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'var(--border-faint)'; e.currentTarget.style.borderColor = 'var(--border-faint)'; }}
            >×</button>
          </div>
        ))}

        {/* New note placeholder card */}
        <div
          onClick={handleCreate}
          style={{
            border: '1px dashed var(--border-dashed)',
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
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-dashed)'}
        >
          <span style={{ color: 'var(--accent)' }}><PlusIcon size={22} /></span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>NEW NOTE</span>
        </div>
      </div>

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>No notes yet</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' }}>PRESS + TO CREATE YOUR FIRST NOTE</div>
        </div>
      )}

      <style>{`
        .delete-btn { opacity: 0; transition: opacity 0.15s; }
        div:hover > .delete-btn { opacity: 1; }
        @media (hover: none) { .delete-btn { opacity: 1; } }
      `}</style>

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
