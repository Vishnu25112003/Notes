import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: '#9a9aa5', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #2e2e36', background: 'transparent', color: '#c8c8d0', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
        >CANCEL</button>
        <button
          onClick={onConfirm}
          style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: danger ? '#ec5d8a' : '#7c6cff', color: danger ? '#fff' : '#0a0a0c', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
        >CONFIRM</button>
      </div>
    </Modal>
  );
}
