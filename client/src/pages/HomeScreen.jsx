import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { addDevice } from '../api/auth.js';
import Modal from '../components/common/Modal.jsx';

const GRID_BG = {
  backgroundColor: '#0a0a0c',
  backgroundImage: 'linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)',
  backgroundSize: '30px 30px',
};

const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>
  </svg>
);

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 3 8l9 5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

export default function HomeScreen() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceStatus, setDeviceStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [deviceError, setDeviceError] = useState(null);

  async function handleAddDevice(e) {
    e.preventDefault();
    setDeviceStatus('loading');
    setDeviceError(null);
    try {
      await addDevice(deviceName.trim() || 'New Device');
      setDeviceStatus('success');
    } catch (err) {
      setDeviceStatus('error');
      setDeviceError(String(err));
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={GRID_BG}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#7c6cff,#4b3fd6 55%,transparent)' }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.3em', color: '#7c6cff', marginBottom: 14 }}
        >
          // PERSONAL KNOWLEDGE WORKSPACE
        </div>

        <div
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(36px,6vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#f4f4f6', lineHeight: 1.05 }}
        >
          Notespace
        </div>

        {/* User bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, marginTop: -4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#55555f' }}>
            @{username}
          </span>
          <button
            onClick={() => { setDeviceStatus(null); setDeviceError(null); setDeviceName(''); setShowDeviceModal(true); }}
            style={{ background: 'none', border: '1px solid #2a2a31', borderRadius: 6, padding: '3px 10px', color: '#55555f', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            title="Add this device for biometric login"
          >
            + Add Device
          </button>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: '#55555f', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
          >
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mt-10">
          <button
            onClick={() => navigate('/simple')}
            className="text-left group"
            style={{
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 18,
              background: 'rgba(255,255,255,.012)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.background = 'rgba(124,108,255,.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.012)'; }}
          >
            <div className="flex justify-between items-start">
              <span style={{ color: '#7c6cff' }}><BoltIcon /></span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>01</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#ededf0', marginTop: 18 }}>Simple Mode</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: '#7c7c86', marginTop: 5, lineHeight: 1.45 }}>Quick notes. Fast jot-down &amp; store.</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              ENTER <ArrowIcon />
            </div>
          </button>

          <button
            onClick={() => navigate('/sections')}
            className="text-left"
            style={{
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 18,
              background: 'rgba(255,255,255,.012)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.background = 'rgba(124,108,255,.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a31'; e.currentTarget.style.background = 'rgba(255,255,255,.012)'; }}
          >
            <div className="flex justify-between items-start">
              <span style={{ color: '#7c6cff' }}><LayersIcon /></span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>02</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#ededf0', marginTop: 18 }}>Section Mode</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, color: '#7c7c86', marginTop: 5, lineHeight: 1.45 }}>Nested pages, rich blocks, drawings.</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7c6cff', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              ENTER <ArrowIcon />
            </div>
          </button>
        </div>
      </div>

      {showDeviceModal && (
        <Modal onClose={() => setShowDeviceModal(false)}>
          <div style={{ padding: '4px 0' }}>
            <h3 style={{ color: '#f4f4f6', fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>
              Add This Device
            </h3>
            <p style={{ color: '#55555f', fontSize: 13, margin: '0 0 20px', fontFamily: "'Space Grotesk', sans-serif" }}>
              Register this device's biometric sensor for instant login.
            </p>
            {deviceStatus === 'success' ? (
              <div style={{ color: '#5be3a0', background: 'rgba(91,227,160,0.08)', border: '1px solid rgba(91,227,160,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 14 }}>
                Device registered successfully! You can now use biometric login on this device.
              </div>
            ) : (
              <form onSubmit={handleAddDevice}>
                <label style={{ display: 'block', color: '#55555f', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Device Name (optional)
                </label>
                <input
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  placeholder="e.g. My MacBook"
                  style={{ width: '100%', background: '#18181f', border: '1px solid #2a2a31', borderRadius: 8, padding: '11px 13px', color: '#f4f4f6', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {deviceError && (
                  <div style={{ color: '#ec5d8a', fontSize: 13, marginTop: 10 }}>{deviceError}</div>
                )}
                <button
                  type="submit"
                  disabled={deviceStatus === 'loading'}
                  style={{ width: '100%', background: '#7c6cff', border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16, fontFamily: 'inherit' }}
                >
                  {deviceStatus === 'loading' ? 'Registering…' : 'Register Biometric'}
                </button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
