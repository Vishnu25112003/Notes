import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useVault } from '../VaultContext.jsx';
import { vaultApi } from '../../api/vault.js';
import Icon from '../components/Icon.jsx';
import StrengthMeter from '../components/StrengthMeter.jsx';
import { importAesKey, newKdfParams, newVaultKeyRaw, passwordKek, recoveryKek, wrapVaultKey, SLOT } from '../crypto/keys.js';
import { newRecoveryKey } from '../crypto/recovery.js';
import { newKeyPair } from '../crypto/ecdh.js';
import { wipe } from '../crypto/encoding.js';
import { enrollThisDevice, guessDeviceName } from '../lib/enroll.js';
import { passkeysSupported, describePasskeyError, PrfUnsupportedError } from '../lib/passkey.js';

const MIN_LENGTH = 10;

export default function VaultSetup() {
  const { username } = useAuth();
  const { enter, duringCeremony } = useVault();
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [score, setScore] = useState(-1);
  const [recovery] = useState(() => newRecoveryKey());
  const [typedGroup, setTypedGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const rawRef = useRef(null);

  // The raw key only exists for the length of the wizard
  useEffect(() => () => { if (rawRef.current) wipe(rawRef.current); wipe(recovery.bytes); }, [recovery]);

  const onScore = useCallback((s) => setScore(s), []);
  const lastGroup = recovery.text.split('-').pop();
  const pwOk = password.length >= MIN_LENGTH && score >= 3 && password === confirm;

  async function createVault() {
    setBusy(true); setError(null);
    try {
      const raw = newVaultKeyRaw();
      rawRef.current = raw;
      const kdf = newKdfParams();
      const wrappedKeyPwd = await wrapVaultKey(await passwordKek(password, kdf), raw, SLOT.pwd);
      const wrappedKeyRecovery = await wrapVaultKey(await recoveryKek(recovery.bytes), raw, SLOT.recovery);
      const vaultKey = await importAesKey(raw);
      const pair = await newKeyPair(vaultKey);
      await vaultApi.setup({ kdf, wrappedKeyPwd, wrappedKeyRecovery, ecdhPublicKey: pair.publicKey, wrappedEcdhPrivate: pair.wrappedPrivate });
      setPassword(''); setConfirm('');
      setStep(3);
    } catch (err) {
      setError(err.message || String(err));
    } finally { setBusy(false); }
  }

  async function finish({ withPasskey }) {
    setBusy(true); setError(null);
    try {
      if (withPasskey) await duringCeremony(() => enrollThisDevice(rawRef.current, guessDeviceName()));
      const meta = await vaultApi.meta();
      const raw = rawRef.current;
      rawRef.current = null;
      await enter(raw, meta);
    } catch (err) {
      setError(err instanceof PrfUnsupportedError ? err.message : describePasskeyError(err));
      setBusy(false);
    }
  }

  function downloadKey() {
    const text = `Notespace Vault recovery key\nAccount: ${username}\nCreated: ${new Date().toLocaleString()}\n\n${recovery.text}\n\nKeep this somewhere safe and offline. Anyone with this key and your account can open your vault.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `notespace-recovery-${username}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="v-center">
      <div className="v-card">
        <div className="v-steps" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map(n => <span key={n} data-on={n <= step} />)}
        </div>

        {step === 1 && (
          <form className="v-panel" onSubmit={e => { e.preventDefault(); if (pwOk) setStep(2); }}>
            <div className="v-lockmark"><Icon name="shield" size={26} /></div>
            <h1 className="v-h1">Create your vault</h1>
            <p className="v-sub" style={{ marginBottom: 22 }}>
              Pick a master password. It encrypts everything on this device before it is uploaded.
              Nobody can reset it, including the Notespace server.
            </p>
            <div className="v-field">
              <label className="v-label" htmlFor="setup-pw">Master password</label>
              <input id="setup-pw" className="v-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
              <StrengthMeter password={password} userInputs={[username, 'notespace', 'vault']} onScore={onScore} />
              {password && password.length < MIN_LENGTH && <div className="v-hint">At least {MIN_LENGTH} characters.</div>}
            </div>
            <div className="v-field">
              <label className="v-label" htmlFor="setup-pw2">Type it again</label>
              <input id="setup-pw2" className="v-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={!!confirm && confirm !== password} />
              {confirm && confirm !== password && <div className="v-error">The two passwords don't match.</div>}
            </div>
            <button type="submit" className="v-btn primary lg block" disabled={!pwOk}>Continue</button>
            {password && score > -1 && score < 3 && <p className="v-hint" style={{ textAlign: 'center' }}>Needs to be at least “Strong”. Try a few unrelated words.</p>}
          </form>
        )}

        {step === 2 && (
          <form className="v-panel" onSubmit={e => { e.preventDefault(); if (typedGroup.trim().toUpperCase() === lastGroup) createVault(); }}>
            <h1 className="v-h1">Save your recovery key</h1>
            <p className="v-sub" style={{ marginBottom: 18 }}>
              If you forget the master password, this key is the only way back in. Print it or store it offline.
              Don't keep it in this vault.
            </p>
            <div className="v-printable">
              <p className="v-hint" style={{ marginTop: 0 }}>Notespace Vault recovery key for @{username}</p>
              <div className="v-recovery" aria-label="Recovery key">
                {recovery.text.split('-').map((g, i) => <span key={i}>{g}</span>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="v-btn" onClick={downloadKey}><Icon name="download" size={16} /> Download</button>
              <button type="button" className="v-btn" onClick={() => window.print()}>Print</button>
              <button type="button" className="v-btn" onClick={() => navigator.clipboard.writeText(recovery.text).catch(() => {})}><Icon name="copy" size={16} /> Copy</button>
            </div>
            <div className="v-field" style={{ marginTop: 22 }}>
              <label className="v-label" htmlFor="setup-group">To confirm you saved it, type the last group</label>
              <input id="setup-group" className="v-input mono" value={typedGroup} onChange={e => setTypedGroup(e.target.value)} maxLength={4} autoComplete="off" spellCheck={false} placeholder="XXXX" style={{ maxWidth: 140, textTransform: 'uppercase' }} />
            </div>
            <button type="submit" className="v-btn primary lg block" disabled={busy || typedGroup.trim().toUpperCase() !== lastGroup}>
              {busy ? 'Encrypting…' : 'Create vault'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button type="button" className="v-linkbtn" onClick={() => setStep(1)} disabled={busy}>Back</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="v-panel">
            <div className="v-lockmark"><Icon name="fingerprint" size={28} /></div>
            <h1 className="v-h1">Unlock with your fingerprint?</h1>
            <p className="v-sub" style={{ marginBottom: 22 }}>
              Add a passkey for this device ({guessDeviceName()}) so you can open the vault with your fingerprint,
              face or device PIN. You can add other devices later in Settings.
            </p>
            {passkeysSupported() ? (
              <button type="button" className="v-btn primary lg block" disabled={busy} onClick={() => finish({ withPasskey: true })}>
                <Icon name="fingerprint" size={20} /> {busy ? 'Waiting for your device…' : 'Add fingerprint unlock'}
              </button>
            ) : (
              <div className="v-banner"><Icon name="warning" /><span>This browser doesn't support passkeys. You'll unlock with your authenticator code and master password.</span></div>
            )}
            <button type="button" className="v-btn lg block" style={{ marginTop: 10 }} disabled={busy} onClick={() => finish({ withPasskey: false })}>
              Skip for now
            </button>
            {error && <div className="v-error" role="alert">{error}</div>}
          </div>
        )}

        {error && step !== 3 && <div className="v-error" role="alert">{error}</div>}
        {step === 1 && (
          <p className="v-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/" style={{ color: 'inherit' }}>Back to Notespace</Link>
          </p>
        )}
      </div>
    </div>
  );
}
