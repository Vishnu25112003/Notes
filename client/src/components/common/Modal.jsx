import { useEffect } from 'react';

export default function Modal({ title, icon, children, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)',
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%', maxWidth: 400,
          background: '#121216',
          border: '1px solid #2a2a31',
          borderRadius: 12,
          padding: 22,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {icon && <span style={{ color: '#7c6cff' }}>{icon}</span>}
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: '#f4f4f6' }}>{title}</span>
          </span>
          <button
            onClick={onClose}
            style={{ color: '#7a7a85', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
