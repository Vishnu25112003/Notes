import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useVault } from '../VaultContext.jsx';
import { vaultApi } from '../../api/vault.js';
import Icon from '../components/Icon.jsx';
import Dialog from '../components/Dialog.jsx';
import StrengthMeter from '../components/StrengthMeter.jsx';
import { useToast } from '../components/Toast.jsx';
import ImportExport from './settings/ImportExport.jsx';
import CategoriesEditor from './settings/CategoriesEditor.jsx';
import { enrollThisDevice, guessDeviceName } from '../lib/enroll.js';
import { getDeviceCredential, setDeviceCredential, passkeysSupported, describePasskeyError } from '../lib/passkey.js';
import { newRecoveryKey } from '../crypto/recovery.js';
import { recoveryKek, wrapVaultKey, SLOT } from '../crypto/keys.js';
import { wipe } from '../crypto/encoding.js';
import { safetyCode } from '../crypto/ecdh.js';
import { fullDate } from '../lib/format.js';

function PasswordPrompt({ title, why, action = 'Continue', onSubmit, onClose }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); try { await onSubmit(password); } catch (err) { setError(describePasskeyError(err)); setBusy(false); } }}>
        <p className="v-sub" style={{ marginTop: 0, marginBottom: 14 }}>{why}</p>
        <label className="v-label" htmlFor="pp-pw">Master password</label>
        <input id="pp-pw" className="v-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} data-autofocus />
        {error && <div className="v-error" role="alert">{error}</div>}
        <div className="v-dialog-foot">
          <button type="button" className="v-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="v-btn primary" disabled={busy || !password}>{busy ? 'Working…' : action}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function ChangePasswordForm({ forced = false, onDone }) {
  const { username } = useAuth();
  const { changePassword } = useVault();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [score, setScore] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const onScore = useCallback(s => setScore(s), []);
  const ok = next.length >= 10 && score >= 3 && next === confirm && (forced || current);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setConfirm('');
      onDone?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      {!forced && (
        <div className="v-field">
          <label className="v-label" htmlFor="cp-cur">Current master password</label>
          <input id="cp-cur" className="v-input" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
      )}
      <div className="v-grid-2">
        <div className="v-field">
          <label className="v-label" htmlFor="cp-new">New master password</label>
          <input id="cp-new" className="v-input" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} autoFocus={forced} />
          <StrengthMeter password={next} userInputs={[username, 'notespace', 'vault']} onScore={onScore} />
        </div>
        <div className="v-field">
          <label className="v-label" htmlFor="cp-new2">Type it again</label>
          <input id="cp-new2" className="v-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={!!confirm && confirm !== next} />
          {confirm && confirm !== next && <div className="v-error">Doesn't match.</div>}
        </div>
      </div>
      {error && <div className="v-error" role="alert">{error}</div>}
      <button type="submit" className="v-btn primary" disabled={busy || !ok}>{busy ? 'Re-encrypting…' : 'Change master password'}</button>
    </form>
  );
}

export default function SettingsPage() {
  const { username } = useAuth();
  const { meta, autoLockMinutes, updateAutoLock, withRawKey, refreshMeta, forceVerify, deleteVault, duringCeremony, lock, offline } = useVault();
  const toast = useToast();
  const device = getDeviceCredential();
  const [prompt, setPrompt] = useState(null);         // 'enroll' | 'recovery'
  const [newKey, setNewKey] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [myCode, setMyCode] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [pwDone, setPwDone] = useState(false);

  useEffect(() => { if (meta?.ecdhPublicKey) safetyCode(meta.ecdhPublicKey).then(setMyCode); }, [meta?.ecdhPublicKey]);

  async function enroll(password) {
    await withRawKey(password, (raw) => duringCeremony(() => enrollThisDevice(raw, guessDeviceName())));
    await refreshMeta();
    setPrompt(null);
    toast('This device can now unlock the vault with your fingerprint');
  }

  async function regenerateRecovery(password) {
    const rk = newRecoveryKey();
    try {
      await withRawKey(password, async (raw) => {
        const wrappedKeyRecovery = await wrapVaultKey(await recoveryKek(rk.bytes), raw, SLOT.recovery);
        await vaultApi.changeRecovery({ wrappedKeyRecovery });
      });
    } finally { wipe(rk.bytes); }
    await refreshMeta();
    setPrompt(null);
    setNewKey(rk.text);
  }

  async function removePasskey() {
    const p = removing;
    setRemoving(null);
    try {
      await forceVerify(`Remove ${p.deviceName}`);
      await vaultApi.passkeyRemove(p.credentialID);
      if (p.credentialID === device) setDeviceCredential(null);
      await refreshMeta();
      toast(`${p.deviceName} removed`);
    } catch (err) { if (err.message !== 'Cancelled') toast(err.message); }
  }

  async function confirmDelete() {
    setDeleteOpen(false);
    try {
      await forceVerify('Delete the whole vault', { passwordOnly: true });
      await deleteVault();
    } catch (err) { if (err.message !== 'Cancelled') toast(err.message); }
  }

  return (
    <div className="v-narrow" style={{ margin: '0 auto' }}>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">Vault settings</h1>
          <p className="v-sub">Signed in as @{username}. Changes here re-encrypt keys on this device; the server only stores the result.</p>
        </div>
      </div>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-labelledby="s-lock">
        <div className="v-section">
          <h2 className="v-h2" id="s-lock">Auto-lock</h2>
          <p className="v-hint" style={{ marginTop: 0 }}>The vault also locks as soon as you switch apps or tabs, and when you leave the vault.</p>
          <div className="v-chips" role="radiogroup" aria-label="Lock after" style={{ marginTop: 10 }}>
            {[1, 5, 15, 30].map(m => (
              <button key={m} type="button" role="radio" aria-checked={autoLockMinutes === m} className="v-chip" aria-pressed={autoLockMinutes === m} disabled={offline}
                onClick={async () => { try { await updateAutoLock(m); toast(`Locks after ${m} minute${m > 1 ? 's' : ''} idle`); } catch (err) { toast(err.message); } }}>
                {m} min
              </button>
            ))}
          </div>
          <button type="button" className="v-btn" style={{ marginTop: 14 }} onClick={() => lock('manual')}><Icon name="lock" size={16} /> Lock now</button>
        </div>
      </section>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-labelledby="s-dev">
        <div className="v-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h2 className="v-h2" id="s-dev">Fingerprint unlock</h2>
              <p className="v-hint" style={{ marginTop: 0 }}>Each device gets its own vault passkey. On a PC without a reader, a nearby phone can unlock over QR.</p>
            </div>
            {passkeysSupported() && !meta?.passkeys?.some(p => p.credentialID === device) && (
              <button type="button" className="v-btn primary" onClick={() => setPrompt('enroll')} disabled={offline}><Icon name="fingerprint" size={16} /> Add this device</button>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
            {(meta?.passkeys || []).length === 0 && <li className="v-hint">No devices yet. Unlocking uses your authenticator code and master password.</li>}
            {(meta?.passkeys || []).map(p => (
              <li key={p.credentialID} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-faint)' }}>
                <Icon name="fingerprint" size={18} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text)' }}>{p.deviceName}</span> {p.credentialID === device && <span className="v-badge warn">This device</span>}
                  <span className="v-hint" style={{ display: 'block', marginTop: 2 }}>Added {fullDate(p.addedAt)}</span>
                </span>
                <button type="button" className="v-btn danger" onClick={() => setRemoving(p)} disabled={offline}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-labelledby="s-pw">
        <div className="v-section">
          <h2 className="v-h2" id="s-pw">Master password</h2>
          <p className="v-hint" style={{ marginTop: 0, marginBottom: 14 }}>Changing it re-wraps your vault key. Your items aren't re-encrypted, and devices with fingerprint unlock keep working.</p>
          {pwDone ? <p className="v-hint" style={{ color: 'var(--success)' }}><Icon name="check" size={15} /> Master password changed.</p> : <ChangePasswordForm onDone={() => { setPwDone(true); toast('Master password changed'); }} />}
        </div>
        <div className="v-section">
          <h2 className="v-h2">Recovery key</h2>
          <p className="v-hint" style={{ marginTop: 0 }}>Make a new one if the old one may have been seen. The old key stops working immediately.</p>
          <button type="button" className="v-btn" style={{ marginTop: 10 }} onClick={() => setPrompt('recovery')} disabled={offline}>Create a new recovery key</button>
        </div>
      </section>

      <section className="v-panel" style={{ marginBottom: 16 }}><CategoriesEditor /></section>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-label="Import and export"><ImportExport /></section>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-labelledby="s-share">
        <div className="v-section">
          <h2 className="v-h2" id="s-share">Your safety code</h2>
          <p className="v-hint" style={{ marginTop: 0 }}>When someone shares an item with you, they see this code. If it matches what they see, nobody swapped your key in between.</p>
          <div className="mono tnum" style={{ fontSize: 18, letterSpacing: '.08em', color: 'var(--text)', marginTop: 10 }} aria-label="Safety code">{myCode || '…'}</div>
        </div>
      </section>

      <section className="v-panel" style={{ marginBottom: 16 }} aria-labelledby="s-limits">
        <div className="v-section">
          <h2 className="v-h2" id="s-limits">What the vault can't protect</h2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, listStyle: 'disc', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            <li>A browser can't clear the clipboard while another app is open, and keyboard clipboard history (Gboard, Windows Win+V) keeps its own copy.</li>
            <li>An unencrypted CSV export stays in Downloads until you delete it.</li>
            <li>JavaScript can't wipe memory. Auto-lock limits how long the key stays loaded.</li>
            <li>If you lose the master password, the recovery key and every device passkey, nobody can recover the data. Not even the server.</li>
            <li>The offline copy on this device can be opened with the master password alone; the server's extra check can't apply without a connection.</li>
            <li>This is a home-built vault using standard algorithms (AES-GCM, Argon2id, ECDH P-256), not an audited product.</li>
          </ul>
        </div>
      </section>

      <section className="v-panel" style={{ marginBottom: 32, borderColor: 'var(--error-border)' }} aria-labelledby="s-danger">
        <div className="v-section">
          <h2 className="v-h2" id="s-danger">Delete vault</h2>
          <p className="v-hint" style={{ marginTop: 0 }}>Permanently deletes every item, category and share, and the encrypted copy on this device. Your notes are not affected.</p>
          <button type="button" className="v-btn danger" style={{ marginTop: 10 }} onClick={() => { setDeleteText(''); setDeleteOpen(true); }} disabled={offline}>Delete vault…</button>
        </div>
      </section>

      {prompt === 'enroll' && (
        <PasswordPrompt title="Add fingerprint unlock" action="Continue" onClose={() => setPrompt(null)} onSubmit={enroll}
          why="Your master password unlocks a copy of the vault key so it can be sealed to this device's passkey." />
      )}
      {prompt === 'recovery' && (
        <PasswordPrompt title="New recovery key" action="Create" onClose={() => setPrompt(null)} onSubmit={regenerateRecovery}
          why="Enter your master password to seal the vault key under a new recovery key." />
      )}
      {newKey && (
        <Dialog title="Your new recovery key" onClose={() => setNewKey(null)} footer={<button type="button" className="v-btn primary" onClick={() => setNewKey(null)} data-autofocus>I've saved it</button>}>
          <p className="v-sub" style={{ marginTop: 0, marginBottom: 12 }}>Write it down or print it now. It won't be shown again, and the old one no longer works.</p>
          <div className="v-printable"><div className="v-recovery">{newKey.split('-').map((g, i) => <span key={i}>{g}</span>)}</div></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="v-btn" onClick={() => window.print()}>Print</button>
            <button type="button" className="v-btn" onClick={() => navigator.clipboard.writeText(newKey).catch(() => {})}><Icon name="copy" size={16} /> Copy</button>
          </div>
        </Dialog>
      )}
      {removing && (
        <Dialog title={`Remove ${removing.deviceName}?`} onClose={() => setRemoving(null)}
          footer={<><button type="button" className="v-btn" onClick={() => setRemoving(null)}>Cancel</button><button type="button" className="v-btn danger solid" onClick={removePasskey} data-autofocus>Remove</button></>}>
          <p className="v-sub" style={{ marginTop: 0 }}>That device will need the master password, or to be added again, to unlock the vault.</p>
        </Dialog>
      )}
      {deleteOpen && (
        <Dialog title="Delete the whole vault?" onClose={() => setDeleteOpen(false)}
          footer={<><button type="button" className="v-btn" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="button" className="v-btn danger solid" disabled={deleteText !== 'DELETE VAULT'} onClick={confirmDelete}>Delete forever</button></>}>
          <div className="v-banner danger" style={{ margin: '8px 0 14px' }}><Icon name="warning" /><span>This can't be undone. Download an encrypted backup first if you might want anything back.</span></div>
          <label className="v-label" htmlFor="del-confirm">Type DELETE VAULT to confirm</label>
          <input id="del-confirm" className="v-input mono" value={deleteText} onChange={e => setDeleteText(e.target.value)} autoComplete="off" data-autofocus />
        </Dialog>
      )}
    </div>
  );
}
