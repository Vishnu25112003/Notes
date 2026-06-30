import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: danger ? 'var(--error)' : 'var(--accent)', color: danger ? '#fff' : 'var(--accent-fg)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
        >CONFIRM</button>
      </div>
    </Modal>
  );
}
