import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useVault } from '../VaultContext.jsx';
import { vaultApi } from '../../api/vault.js';
import Icon from '../components/Icon.jsx';
import { parseLinkHash, matchCode, sealAnswer } from '../lib/link.js';
import { getDeviceCredential, passkeysSupported, describePasskeyError } from '../lib/passkey.js';
import { guessDeviceName } from '../lib/enroll.js';
import { wipe } from '../crypto/encoding.js';

// Phone side of "unlock with your phone": opened by scanning the QR on the computer
export default function LinkApprove() {
  const { hash } = useLocation();
  const { meta, rawForTransfer } = useVault();
  const parsed = useMemo(() => parseLinkHash(hash), [hash]);
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const hasPasskey = passkeysSupported() && !!meta?.passkeys?.some(p => p.credentialID === getDeviceCredential());
  const [usePassword, setUsePassword] = useState(!hasPasskey);
  const [totp, setTotp] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!parsed) return;
    matchCode(parsed.linkId, parsed.pub).then(setCode);
    vaultApi.linkInfo(parsed.linkId).then(setInfo).catch(err => setError(err.message));
  }, [parsed]);

  async function approve(e) {
    e?.preventDefault();
    setBusy(true); setError(null);
    let raw;
    try {
      raw = await rawForTransfer(usePassword ? { method: 'password', code: totp, password } : { method: 'passkey' });
      const answer = await sealAnswer(raw, parsed.linkId, parsed.pub);
      await vaultApi.linkApprove(parsed.linkId, { ...answer, deviceName: guessDeviceName() });
      setDone(true);
      setPassword('');
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      if (raw) wipe(raw);
      setBusy(false);
    }
  }

  if (!parsed) {
    return (
      <div className="v-center"><div className="v-card v-panel v-empty">
        <Icon name="warning" size={30} />
        <div className="v-h2">This link isn't complete</div>
        <div>Scan the QR code on the computer again.</div>
        <Link to="/vault" className="v-btn">Open my vault</Link>
      </div></div>
    );
  }

  return (
    <div className="v-center">
      <div className="v-card">
        <div className="v-panel">
          {done ? (
            <div className="v-empty" style={{ padding: '12px 0' }}>
              <span className="v-lockmark" style={{ margin: 0 }}><Icon name="check" size={26} /></span>
              <h1 className="v-h1">Approved</h1>
              <p className="v-sub" style={{ textAlign: 'center' }}>{info?.deviceName || 'Your computer'} is unlocking now. You can put your phone away.</p>
              <Link to="/vault" className="v-btn">Back to my vault</Link>
            </div>
          ) : (
            <>
              <div className="v-lockmark"><Icon name="unlock" size={26} /></div>
              <h1 className="v-h1">Unlock your vault on {info?.deviceName || 'a computer'}?</h1>
              <p className="v-sub" style={{ marginBottom: 16 }}>Only approve if you're at that computer right now and you just showed this QR code.</p>
              <div className="v-banner" style={{ display: 'block', marginBottom: 18 }}>
                <div className="v-hint" style={{ marginTop: 0 }}>The computer should show the same code:</div>
                <div className="mono tnum" style={{ fontSize: 26, letterSpacing: '.12em', color: 'var(--text)', marginTop: 4 }} aria-label="Matching code">{code}</div>
              </div>

              {!usePassword ? (
                <>
                  <button type="button" className="v-btn primary lg block" disabled={busy || !info || error?.includes('expired')} onClick={() => approve()}>
                    <Icon name="fingerprint" size={20} /> {busy ? 'Waiting for your fingerprint…' : 'Approve with fingerprint'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button type="button" className="v-linkbtn" onClick={() => setUsePassword(true)}>Use authenticator code + master password</button>
                  </div>
                </>
              ) : (
                <form onSubmit={approve}>
                  <div className="v-field">
                    <label className="v-label" htmlFor="la-code">Authenticator code</label>
                    <input id="la-code" className="v-input mono tnum" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ fontSize: 20, letterSpacing: '.3em', textAlign: 'center' }} />
                  </div>
                  <div className="v-field">
                    <label className="v-label" htmlFor="la-pw">Master password</label>
                    <input id="la-pw" className="v-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <button type="submit" className="v-btn primary lg block" disabled={busy || !info || totp.length !== 6 || !password}>{busy ? 'Approving…' : 'Approve'}</button>
                  {hasPasskey && <div style={{ textAlign: 'center', marginTop: 12 }}><button type="button" className="v-linkbtn" onClick={() => setUsePassword(false)}>Use fingerprint instead</button></div>}
                </form>
              )}
              {error && <div className="v-error" role="alert">{error}</div>}
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <Link to="/vault" className="v-linkbtn">Not me, cancel</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
