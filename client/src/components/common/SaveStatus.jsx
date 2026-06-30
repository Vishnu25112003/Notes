export default function SaveStatus({ status }) {
  if (status === 'saving') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--warning)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', display: 'block', animation: 'blink 1s steps(1) infinite' }} />
        SAVING…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--error)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--error)', display: 'block' }} />
        ERROR
      </span>
    );
  }
  if (status === 'saved') {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--success)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'block' }} />
        SAVED · {time}
      </span>
    );
  }
  return null;
}
