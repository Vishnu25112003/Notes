import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe } from '../api/share.js';
import Loader from '../components/common/Loader.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';

const GRID_BG = {
  backgroundColor: 'var(--bg)',
  backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
  backgroundSize: '32px 32px',
};

const CARD_COLORS = ['#7c6cff', '#5be3a0', '#f5a524', '#ec5d8a'];

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

const ShareIcon = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
  </svg>
);

const chip = (text, color) => (
  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: '0.08em', color, border: `1px solid ${color}55`, borderRadius: 10, padding: '2px 7px' }}>
    {text}
  </span>
);

export default function SharedList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getSharedWithMe()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen flex flex-col" style={GRID_BG}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

      <style>{`
        .sharedlist-header { padding: 18px 26px; }
        .sharedlist-badge { display: inline; }
        .sharedlist-grid { padding: 20px 26px; }
        @media (max-width: 640px) {
          .sharedlist-header { padding: 14px 16px; }
          .sharedlist-badge { display: none; }
          .sharedlist-grid { padding: 16px 16px; }
        }
      `}</style>

      {/* Header */}
      <div className="sharedlist-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <BackArrow /> HOME
          </button>
          <span style={{ width: 1, height: 18, background: 'var(--divider)', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Shared with me</span>
          <span className="sharedlist-badge" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--accent)', border: '1px solid rgba(124,108,255,.4)', borderRadius: 20, padding: '3px 9px', flexShrink: 0 }}>
            {String(items.length).padStart(2, '0')} SHARED
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Grid */}
      <div className="sharedlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%), 1fr))', gap: 14 }}>
        {items.map((item, i) => {
          const color = CARD_COLORS[i % CARD_COLORS.length];
          return (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => navigate(`/shared/${item.type}/${item.id}`)}
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
              <div style={{ color, marginTop: 6 }}><ShareIcon color={color} /></div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--text-2)', marginTop: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title || 'Untitled'}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-label)', letterSpacing: '0.08em', marginTop: 8 }}>
                BY @{item.ownerUsername.toUpperCase()} · {relativeTime(item.updatedAt)}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {chip(item.type.toUpperCase(), 'var(--text-dim)')}
                {chip(item.permission === 'edit' ? 'CAN EDIT' : 'VIEW ONLY', '#7c6cff')}
                {!item.accessible && chip('REQUEST ACCESS', 'var(--error)')}
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Nothing shared with you yet</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' }}>NOTES OTHERS SHARE WITH YOU WILL APPEAR HERE</div>
        </div>
      )}
    </div>
  );
}
