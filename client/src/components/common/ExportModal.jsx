import { useState } from 'react';
import Modal from './Modal.jsx';
import { exportPdf, exportDoc, exportMarkdown, exportTxt } from '../../utils/exportNote.js';

const FileIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
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

  return (
    <Modal title="Export" onClose={onClose}>
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
