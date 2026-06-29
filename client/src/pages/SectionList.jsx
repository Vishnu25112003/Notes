import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSections, createSection, deleteSection } from '../api/sections.js';
import Loader from '../components/common/Loader.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Modal from '../components/common/Modal.jsx';

const GRID_BG = {
  backgroundColor: '#0a0a0c',
  backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)',
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
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: '#f4f4f6' }}>Sections</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', border: '1px solid rgba(124,108,255,.4)', borderRadius: 20, padding: '3px 9px' }}>
            {String(sections.length).padStart(2, '0')} SECTIONS
          </span>
        </div>
        <button
          onClick={() => { setNewTitle(''); setCreating(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#0a0a0c', background: '#7c6cff', border: 'none', borderRadius: 7, padding: '9px 15px', fontWeight: 600, cursor: 'pointer' }}
        >
          <PlusIcon /> NEW SECTION
        </button>
      </div>

      {/* Grid */}
      <div style={{ padding: '24px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {sections.map((s, i) => {
          const color = SECTION_COLORS[i % SECTION_COLORS.length];
          return (
            <div
              key={s._id}
              onClick={() => navigate(`/sections/${s._id}`)}
              style={{
                position: 'relative',
                border: '1px solid #2a2a31',
                borderRadius: 9,
                padding: 20,
                background: 'rgba(255,255,255,.014)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.background = `${color}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.014)'; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
              <div style={{ color, marginTop: 6 }}><LayersIcon color={color} /></div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#ededf0', marginTop: 16 }}>{s.title}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f', letterSpacing: '0.08em', marginTop: 8 }}>
                UPDATED {relativeTime(s.updatedAt)}
              </div>
              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(s); }}
                style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#55555f', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ec5d8a'}
                onMouseLeave={e => e.currentTarget.style.color = '#55555f'}
              >×</button>
            </div>
          );
        })}

        {/* New section placeholder */}
        <div
          onClick={() => { setNewTitle(''); setCreating(true); }}
          style={{
            border: '1px dashed #34343c',
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
          onMouseLeave={e => e.currentTarget.style.borderColor = '#34343c'}
        >
          <span style={{ color: '#7c6cff' }}><PlusIcon size={22} /></span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: '#7a7a85' }}>NEW SECTION</span>
        </div>
      </div>

      {creating && (
        <Modal title="New Section" onClose={() => setCreating(false)}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: '#55555f', marginBottom: 7 }}>SECTION TITLE</div>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Section title"
            style={{
              width: '100%',
              background: '#0a0a0c',
              border: '1px solid #7c6cff',
              borderRadius: 8,
              padding: '11px 13px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              color: '#ededf0',
              outline: 'none',
              display: 'block',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 }}>
            <button
              onClick={() => setCreating(false)}
              style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #2e2e36', background: 'transparent', color: '#c8c8d0', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
            >CANCEL</button>
            <button
              onClick={handleCreate}
              style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: '#7c6cff', color: '#0a0a0c', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
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
