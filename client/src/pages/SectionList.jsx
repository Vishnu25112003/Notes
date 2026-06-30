import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSections, createSection, deleteSection } from '../api/sections.js';
import Loader from '../components/common/Loader.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Modal from '../components/common/Modal.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';

const GRID_BG = {
  backgroundColor: 'var(--bg)',
  backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
  backgroundSize: '32px 32px',
};

const SECTION_COLORS = ['#7c6cff', '#5be3a0', '#f5a524', '#ec5d8a'];

function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hrs < 1) return 'JUST NOW';
  if (hrs < 24) return `${hrs}H AGO`;
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days}D AGO`;
  return `${Math.floor(days / 7)}W AGO`;
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

const LayersIcon = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 3 8l9 5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
  </svg>
);

export default function SectionList() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try { setSections(await getSections()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const s = await createSection({ title: newTitle });
    setCreating(false);
    setNewTitle('');
    navigate(`/sections/${s._id}`);
  };

  const handleDelete = async () => {
    await deleteSection(deleteTarget._id);
    setDeleteTarget(null);
    load();
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen flex flex-col" style={GRID_BG}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

      <style>{`
        .sectionlist-header { padding: 18px 26px; }
        .sectionlist-badge { display: inline; }
        .sectionlist-grid { padding: 20px 26px; }
        @media (max-width: 640px) {
          .sectionlist-header { padding: 14px 16px; }
          .sectionlist-badge { display: none; }
          .sectionlist-grid { padding: 16px 16px; }
        }
      `}</style>

      {/* Header */}
      <div className="sectionlist-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <BackArrow /> HOME
          </button>
          <span style={{ width: 1, height: 18, background: 'var(--divider)', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sections</span>
          <span className="sectionlist-badge" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--accent)', border: '1px solid rgba(124,108,255,.4)', borderRadius: 20, padding: '3px 9px', flexShrink: 0 }}>
            {String(sections.length).padStart(2, '0')} SECTIONS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ThemeToggle />
          <button
            onClick={() => { setNewTitle(''); setCreating(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent-fg)', background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '9px 15px', fontWeight: 600, cursor: 'pointer' }}
          >
            <PlusIcon /> NEW SECTION
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="sectionlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%), 1fr))', gap: 14 }}>
        {sections.map((s, i) => {
          const color = SECTION_COLORS[i % SECTION_COLORS.length];
          return (
            <div
              key={s._id}
              onClick={() => navigate(`/sections/${s._id}`)}
              style={{
                position: 'relative',
                border: '1px solid var(--border)',
                borderRadius: 9,
                padding: 20,
                background: 'var(--card-subtle)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.background = `${color}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-subtle)'; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
              <div style={{ color, marginTop: 6 }}><LayersIcon color={color} /></div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--text-2)', marginTop: 16 }}>{s.title}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-label)', letterSpacing: '0.08em', marginTop: 8 }}>
                UPDATED {relativeTime(s.updatedAt)}
              </div>
              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(s); }}
                style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text-label)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-label)'}
              >×</button>
            </div>
          );
        })}

        {/* New section placeholder */}
        <div
          onClick={() => { setNewTitle(''); setCreating(true); }}
          style={{
            border: '1px dashed var(--border-dashed)',
            borderRadius: 9,
            minHeight: 138,
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
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>NEW SECTION</span>
        </div>
      </div>

      {creating && (
        <Modal title="New Section" onClose={() => setCreating(false)}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-label)', marginBottom: 7 }}>SECTION TITLE</div>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Section title"
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: '11px 13px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              color: 'var(--text-2)',
              outline: 'none',
              display: 'block',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 }}>
            <button
              onClick={() => setCreating(false)}
              style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
            >CANCEL</button>
            <button
              onClick={handleCreate}
              style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
            >CREATE</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete section?"
          message={`Delete "${deleteTarget.title}" and all its pages?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
