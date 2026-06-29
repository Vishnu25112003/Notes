import { useNavigate } from 'react-router-dom';

const GRID_BG = {
  backgroundColor: '#0a0a0c',
  backgroundImage: 'linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)',
  backgroundSize: '30px 30px',
};

const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>
  </svg>
);

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 3 8l9 5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

export default function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={GRID_BG}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#7c6cff,#4b3fd6 55%,transparent)' }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.3em', color: '#7c6cff', marginBottom: 14 }}
        >
          // PERSONAL KNOWLEDGE WORKSPACE
        </div>

        <div
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(36px,6vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#f4f4f6', lineHeight: 1.05 }}
        >
          Notespace
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mt-10">
          <button
            onClick={() => navigate('/simple')}
            className="text-left group"
            style={{
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 18,
              background: 'rgba(255,255,255,.012)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.background = 'rgba(124,108,255,.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.012)'; }}
          >
            <div className="flex justify-between items-start">
              <span style={{ color: '#7c6cff' }}><BoltIcon /></span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>01</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#ededf0', marginTop: 18 }}>Simple Mode</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: '#7c7c86', marginTop: 5, lineHeight: 1.45 }}>Quick notes. Fast jot-down &amp; store.</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              ENTER <ArrowIcon />
            </div>
          </button>

          <button
            onClick={() => navigate('/sections')}
            className="text-left"
            style={{
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 18,
              background: 'rgba(255,255,255,.012)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.background = 'rgba(124,108,255,.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.012)'; }}
          >
            <div className="flex justify-between items-start">
              <span style={{ color: '#7c6cff' }}><LayersIcon /></span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>02</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#ededf0', marginTop: 18 }}>Section Mode</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: '#7c7c86', marginTop: 5, lineHeight: 1.45 }}>Nested pages, rich blocks, drawings.</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              ENTER <ArrowIcon />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
