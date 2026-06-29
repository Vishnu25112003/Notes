export default function Loader({ fullScreen }) {
  const style = fullScreen
    ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' };

  return (
    <div style={style}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid #7c6cff',
        borderTopColor: 'transparent',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
