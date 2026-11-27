import { useState } from 'react';
import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';
import { useVault } from '../VaultContext.jsx';
import { getDeviceCredential, describePasskeyError } from '../lib/passkey.js';

// Shown when reveal/copy/delete/export needs a fresh check. Passkey if this device has one, else master password.
export default function ReverifyDialog() {
  const { reverify, cancelVerify, verifyWithPassword, verifyWithPasskey, meta } = useVault();
  const device = getDeviceCredential();
  const hasDevicePasskey = !reverify?.passwordOnly && !!meta?.passkeys?.some(p => p.credentialID === device);
  const [usePassword, setUsePassword] = useState(!hasDevicePasskey);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!reverify) return null;

  async function run(fn) {
    setBusy(true); setError(null);
    try { await fn(); setPassword(''); } catch (err) { setError(describePasskeyError(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog title="Confirm it's you" onClose={cancelVerify} describedBy="reverify-why">
      <p id="reverify-why" className="v-sub" style={{ marginTop: 0, marginBottom: 18 }}>
        {reverify.reason || 'This action'} needs a fresh check.
        {!reverify.passwordOnly && ' You won’t be asked again for 60 seconds.'}
      </p>
      {!usePassword ? (
        <>
          <button type="button" className="v-btn primary lg block" disabled={busy} onClick={() => run(verifyWithPasskey)} data-autofocus>
            <Icon name="fingerprint" size={20} /> {busy ? 'Waiting for your device…' : 'Use fingerprint or face'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" className="v-linkbtn" onClick={() => setUsePassword(true)}>Use master password instead</button>
          </div>
        </>
      ) : (
        <form onSubmit={e => { e.preventDefault(); run(() => verifyWithPassword(password)); }}>
          <label className="v-label" htmlFor="reverify-pw">Master password</label>
          <input id="reverify-pw" className="v-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} data-autofocus aria-invalid={!!error} />
          <button type="submit" className="v-btn primary block lg" style={{ marginTop: 14 }} disabled={busy || !password}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
          {hasDevicePasskey && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="v-linkbtn" onClick={() => setUsePassword(false)}>Use fingerprint or face instead</button>
            </div>
          )}
        </form>
      )}
      {error && <div className="v-error" role="alert">{error}</div>}
    </Dialog>
  );
}
