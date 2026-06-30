const DocIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
  </svg>
);

export default function EmptyState({ title, desc, onAction, actionLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 14, textAlign: 'center' }}>
      <div style={{
        position: 'relative', width: 70, height: 70,
        border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(124,108,255,.06)',
      }}>
        <span style={{ color: 'var(--accent)' }}><DocIcon /></span>
        {onAction && (
          <span style={{
            position: 'absolute', bottom: -6, right: -6,
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--accent-fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1, cursor: 'pointer',
          }} onClick={onAction}>+</span>
        )}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--text-2)' }}>{title}</div>
      {desc && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-dim)' }}>{desc}</div>}
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent-fg)', background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '9px 16px', fontWeight: 600, cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
