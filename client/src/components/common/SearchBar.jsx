import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { search as searchApi } from '../../api/search.js';

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)' }}>
    <circle cx="11" cy="11" r="7"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await searchApi(q);
        setResults(res);
        setOpen(true);
      } catch {}
    }, 350);
  };

  const handleSelect = (item) => {
    setOpen(false);
    setQuery('');
    if (item.type === 'note') navigate(`/simple/${item.id}`);
    else navigate(`/sections/${item.sectionId}/pages/${item.id}`);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', maxWidth: 280 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        padding: '7px 12px',
      }}>
        <SearchIcon />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search all notes & pages…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'var(--text-mid)',
          }}
        />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-label)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>⌘K</span>
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px -8px rgba(0,0,0,.3)',
          zIndex: 50, maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map(item => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-faint)',
                cursor: 'pointer', display: 'block',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border-faint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--accent)', letterSpacing: '0.1em' }}>{item.type.toUpperCase()}</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
              </div>
              {item.snippet && (
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.snippet}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px -8px rgba(0,0,0,.3)',
          zIndex: 50, padding: '12px 14px',
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-label)' }}>No results</span>
        </div>
      )}
    </div>
  );
}
