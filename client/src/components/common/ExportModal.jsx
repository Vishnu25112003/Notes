import { useState } from 'react';
import Modal from './Modal.jsx';
import { exportPdf, exportDoc, exportMarkdown, exportTxt, shareNote } from '../../utils/exportNote.js';

const FileIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
  </svg>
);

const FORMATS = [
  { key: 'pdf', label: 'PDF', desc: 'Print-ready document', color: '#ec5d8a', run: exportPdf },
  { key: 'doc', label: 'DOC', desc: 'Microsoft Word', color: '#4a9eda', run: exportDoc },
  { key: 'md', label: 'MD', desc: 'Markdown text', color: '#7c6cff', run: exportMarkdown },
  { key: 'txt', label: 'TXT', desc: 'Plain text', color: '#5be3a0', run: exportTxt },
];

export default function ExportModal({ title, content, onClose }) {
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);

  const handleExport = async (fmt) => {
    if (busy) return;
    setBusy(fmt.key);
    setStatus(null);
    try {
      await fmt.run(title, content);
      setStatus({ ok: true, text: `${fmt.label} EXPORTED` });
    } catch {
      setStatus({ ok: false, text: `${fmt.label} EXPORT FAILED` });
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy('share');
    setStatus(null);
    const result = await shareNote(title, content);
    if (result === 'copied') setStatus({ ok: true, text: 'COPIED TO CLIPBOARD' });
    else if (result === 'failed') setStatus({ ok: false, text: 'SHARE NOT AVAILABLE' });
    setBusy(null);
  };

  return (
    <Modal title="Export & Share" onClose={onClose}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-label)', marginBottom: 10 }}>
        EXPORT “{(title || 'Untitled').toUpperCase().slice(0, 28)}” AS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FORMATS.map(fmt => (
          <button
            key={fmt.key}
            onClick={() => handleExport(fmt)}
            disabled={!!busy}
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7,
              padding: '13px 14px',
              border: '1px solid var(--border)',
              borderRadius: 9,
              background: 'var(--card-subtle)',
              cursor: busy ? 'wait' : 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              opacity: busy && busy !== fmt.key ? 0.5 : 1,
              transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${fmt.color}70`; e.currentTarget.style.background = `${fmt.color}0d`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-subtle)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: fmt.color }} />
            <FileIcon color={fmt.color} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>
              {busy === fmt.key ? 'Exporting…' : `.${fmt.key}`}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--text-label)' }}>
              {fmt.desc.toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 12px' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--text-label)' }}>OR</span>
        <span style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
      </div>

      <button
        onClick={handleShare}
        disabled={!!busy}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          cursor: busy ? 'wait' : 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, letterSpacing: '0.08em', fontWeight: 600,
          opacity: busy && busy !== 'share' ? 0.5 : 1,
        }}
      >
        <ShareIcon /> {busy === 'share' ? 'SHARING…' : 'SHARE THIS NOTE'}
      </button>

      {status && (
        <div style={{
          marginTop: 12, textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
          color: status.ok ? 'var(--success, #5be3a0)' : 'var(--error)',
        }}>
          {status.ok ? '✓ ' : '✕ '}{status.text}
        </div>
      )}
    </Modal>
  );
}
