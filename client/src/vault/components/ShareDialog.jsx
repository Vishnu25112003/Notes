import { useEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';
import { useVault } from '../VaultContext.jsx';
import { useToast } from './Toast.jsx';
import { vaultApi } from '../../api/vault.js';
import { safetyCode } from '../crypto/ecdh.js';
import { timeAgo } from '../lib/format.js';

// End-to-end sharing with one Notespace user at a time. They can view and copy, never edit.
export default function ShareDialog({ item, onClose }) {
  const { shareItem, revokeShare, ensureVerified, offline } = useVault();
  const toast = useToast();
  const [shares, setShares] = useState(null);
  const [name, setName] = useState('');
  const [recipient, setRecipient] = useState(null); // { username, publicKey, code }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    vaultApi.itemShares(item.id).then(r => setShares(r.shares)).catch(err => setError(err.message));
  }, [item.id]);

  async function lookUp(e) {
    e.preventDefault();
    setBusy(true); setError(null); setRecipient(null);
    try {
      const r = await vaultApi.recipient(name.trim());
      setRecipient({ ...r, code: await safetyCode(r.publicKey) });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function confirmShare() {
    setBusy(true); setError(null);
    try {
      await ensureVerified(`Share “${item.data.title}”`);
      const share = await shareItem(item.id, recipient);
      setShares(s => [...(s || []), share]);
      toast(`Shared with ${recipient.username}`);
      setRecipient(null); setName('');
    } catch (err) { if (err.message !== 'Cancelled') setError(err.message); } finally { setBusy(false); }
  }

  async function confirmRevoke() {
    const s = revoking;
    setBusy(true); setError(null);
    try {
      await ensureVerified('Stop sharing');
      const remaining = await revokeShare(item.id, s.id);
      setShares(remaining);
      setRevoking(null);
      toast(`${s.recipientUsername} no longer has access. Change the password on the site.`, 4500);
    } catch (err) { if (err.message !== 'Cancelled') setError(err.message); } finally { setBusy(false); }
  }

  if (revoking) {
    return (
      <Dialog
        title={`Stop sharing with ${revoking.recipientUsername}?`}
        onClose={() => setRevoking(null)}
        footer={<>
          <button type="button" className="v-btn" onClick={() => setRevoking(null)}>Cancel</button>
          <button type="button" className="v-btn danger solid" disabled={busy} onClick={confirmRevoke} data-autofocus>{busy ? 'Re-encrypting…' : 'Stop sharing'}</button>
        </>}
      >
        <p className="v-sub" style={{ marginTop: 0 }}>
          They lose access right away, and this item gets a new encryption key. But they may already have seen or copied the password,
          so the item will remind you to change it on the site.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog title={`Share “${item.data.title || 'Untitled'}”`} onClose={onClose}>
      <p className="v-sub" style={{ marginTop: 0, marginBottom: 16 }}>
        Encrypted for one person's vault. They can view and copy it, but not edit it. Changes you make reach them automatically.
      </p>
      {offline ? (
        <div className="v-banner"><Icon name="cloudOff" /><span>Sharing needs a connection.</span></div>
      ) : recipient ? (
        <div>
          <div className="v-banner" style={{ display: 'block' }}>
            <div>Share with <strong>@{recipient.username}</strong>?</div>
            <div className="v-hint" style={{ marginTop: 8 }}>Safety code. Ask them to open Vault › Settings and check theirs matches:</div>
            <div className="mono tnum" style={{ fontSize: 17, letterSpacing: '.08em', color: 'var(--text)', marginTop: 6 }}>{recipient.code}</div>
          </div>
          <div className="v-dialog-foot">
            <button type="button" className="v-btn" onClick={() => setRecipient(null)}>Back</button>
            <button type="button" className="v-btn primary" disabled={busy} onClick={confirmShare} data-autofocus>{busy ? 'Encrypting…' : 'Share read-only'}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={lookUp} style={{ display: 'flex', gap: 8 }}>
          <input className="v-input" aria-label="Notespace username" placeholder="Their Notespace username" value={name} onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} maxLength={20} autoCapitalize="none" spellCheck={false} data-autofocus />
          <button type="submit" className="v-btn primary" disabled={busy || name.trim().length < 3}>{busy ? 'Looking…' : 'Next'}</button>
        </form>
      )}
      {error && <div className="v-error" role="alert">{error}</div>}

      <h3 className="v-label" style={{ marginTop: 22 }}>Shared with</h3>
      {shares === null ? <p className="v-hint">Loading…</p> : shares.length === 0 ? <p className="v-hint">Nobody yet.</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shares.map(s => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border-faint)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text)' }}>@{s.recipientUsername}</span>
                <span className="v-hint" style={{ display: 'block', marginTop: 2 }}>Since {timeAgo(s.createdAt)}</span>
              </span>
              <button type="button" className="v-btn danger" onClick={() => setRevoking(s)} disabled={offline}>Stop sharing</button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
