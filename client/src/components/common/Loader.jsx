import SpiralLoader from '../ui/loader.jsx';

export default function Loader({ fullScreen }) {
  const style = fullScreen
    ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' };

  return (
    <div style={style}>
      <SpiralLoader />
    </div>
  );
}
