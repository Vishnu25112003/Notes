import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WebAuthnAbortService } from '@simplewebauthn/browser';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import QrUnlock from '../components/QrUnlock.jsx';
import { getDeviceCredential, passkeysSupported, describePasskeyError } from '../lib/passkey.js';

function CodeInput({ value, onChange, autoFocus }) {
  return (
    <input
      className="v-input mono tnum" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
      value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000" autoFocus={autoFocus} aria-label="6-digit authenticator code"
      style={{ fontSize: 22, letterSpacing: '0.35em', textAlign: 'center' }}
    />
  );
}

function QrButton({ onClick }) {
  return (
    <button type="button" className="v-btn block" onClick={onClick} style={{ marginTop: 10 }}>
      <Icon name="phone" size={17} /> Unlock with your phone (scan a QR code)
    </button>
  );
}

export default function VaultUnlock() {
  const { statusInfo, meta, offline, unlockWithPasskey, unlockWithPassword, unlockWithRecovery, unlockOfflinePasskey } = useVault();
  // After a lock in this session, the last-known key list is fresher than the status fetched at page load
  const passkeyCount = Math.max(statusInfo?.passkeyCount || 0, meta?.passkeys?.length || 0);
  const hasPasskeys = passkeyCount > 0 && passkeysSupported();
  const deviceHasPasskey = !!getDeviceCredential();
  const cachedOnly = offline || statusInfo?.cachedOnly;
  const [mode, setMode] = useState(hasPasskeys && (deviceHasPasskey || !cachedOnly) ? 'passkey' : 'password');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryText, setRecoveryText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const triedAuto = useRef(false);

  // Switching method cancels a passkey prompt that is still waiting, so the other form is usable straight away
  function switchMode(next) {
    WebAuthnAbortService.cancelCeremony();
    setBusy(false);
    setError(null);
    setMode(next);
  }

  async function run(fn, { silent = false } = {}) {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) {
      // AbortError means the person switched method; nothing to report
      if (!silent && err?.name !== 'AbortError' && err?.cause?.name !== 'AbortError') setError(describePasskeyError(err));
      setBusy(false);
    }
  }

  // On a device that already has a vault passkey, open the prompt straight away (one tap fewer)
  useEffect(() => {
    if (mode === 'passkey' && deviceHasPasskey && !triedAuto.current && !cachedOnly) {
      triedAuto.current = true;
      // Safari needs a tap before a passkey prompt; if this auto-attempt is refused, the button still works
      run(unlockWithPasskey, { silent: true });
    }
  }, [mode, deviceHasPasskey, cachedOnly, unlockWithPasskey]);

  return (
    <div className="v-center">
      <div className="v-card">
        <div className="v-panel">
          <div className="v-lockmark"><Icon name="lock" size={26} /></div>
          <h1 className="v-h1">Vault is locked</h1>
          <p className="v-sub" style={{ marginBottom: 22 }}>
            {mode === 'qr'
              ? 'Scan this code with your phone, where your vault is set up with fingerprint.'
              : mode === 'recovery'
              ? 'Use your authenticator code and the recovery key you saved when you created the vault.'
              : cachedOnly
                ? "You're offline. Unlocking uses the encrypted copy saved on this device."
                : 'Your passwords are encrypted. Confirm it’s you to open them.'}
          </p>

          {mode === 'passkey' && (
            <>
              <button type="button" className="v-btn primary lg block" disabled={busy} onClick={() => run(cachedOnly ? unlockOfflinePasskey : unlockWithPasskey)}>
                <Icon name="fingerprint" size={20} /> {busy ? 'Waiting for your device…' : 'Unlock with fingerprint'}
              </button>
              {!deviceHasPasskey && !cachedOnly && (
                <p className="v-hint" style={{ textAlign: 'center' }}>
                  No passkey on this device yet. Your browser can use a phone nearby: pick “Use a phone or tablet” and scan the QR code.
                </p>
              )}
              <div className="v-divider">or</div>
              <button type="button" className="v-btn block" onClick={() => switchMode('password')}>
                Use {cachedOnly ? 'master password' : 'authenticator code + master password'}
              </button>
              {!cachedOnly && <QrButton onClick={() => switchMode('qr')} />}
            </>
          )}

          {mode === 'qr' && <QrUnlock onBack={() => switchMode(hasPasskeys ? 'passkey' : 'password')} />}

          {mode === 'password' && (
            <form onSubmit={e => { e.preventDefault(); run(() => unlockWithPassword(code, password)); }}>
              {!cachedOnly && (
                <div className="v-field">
                  <label className="v-label">Authenticator code</label>
                  <CodeInput value={code} onChange={setCode} autoFocus />
                </div>
              )}
              <div className="v-field">
                <label className="v-label" htmlFor="unlock-pw">Master password</label>
                <input id="unlock-pw" className="v-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus={cachedOnly} />
              </div>
              <button type="submit" className="v-btn primary lg block" disabled={busy || !password || (!cachedOnly && code.length !== 6)}>
                {busy ? 'Unlocking…' : 'Unlock'}
              </button>
              {!cachedOnly && <QrButton onClick={() => switchMode('qr')} />}
              {hasPasskeys && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button type="button" className="v-linkbtn" onClick={() => switchMode('passkey')}>Use fingerprint instead</button>
                </div>
              )}
            </form>
          )}

          {mode === 'recovery' && (
            <form onSubmit={e => { e.preventDefault(); run(() => unlockWithRecovery(code, recoveryText)); }}>
              <div className="v-field">
                <label className="v-label">Authenticator code</label>
                <CodeInput value={code} onChange={setCode} autoFocus />
              </div>
              <div className="v-field">
                <label className="v-label" htmlFor="unlock-rec">Recovery key</label>
                <textarea id="unlock-rec" className="v-textarea mono" rows={3} value={recoveryText} onChange={e => setRecoveryText(e.target.value)} spellCheck={false} autoComplete="off" placeholder="XXXX-XXXX-XXXX-…" style={{ minHeight: 0 }} />
              </div>
              <button type="submit" className="v-btn primary lg block" disabled={busy || code.length !== 6 || !recoveryText.trim()}>
                {busy ? 'Unlocking…' : 'Unlock and set a new password'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button type="button" className="v-linkbtn" onClick={() => switchMode(hasPasskeys ? 'passkey' : 'password')}>Back</button>
              </div>
            </form>
          )}

          {error && <div className="v-error" role="alert">{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="v-linkbtn">Back to Notespace</Link>
          {mode !== 'recovery' && !cachedOnly && (
            <button type="button" className="v-linkbtn" onClick={() => switchMode('recovery')}>Forgot master password?</button>
          )}
        </div>
      </div>
    </div>
  );
}
