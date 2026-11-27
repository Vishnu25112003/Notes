import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { useVault } from '../VaultContext.jsx';
import { fullDate } from '../lib/format.js';

const FIELDS = [['title', 'Name'], ['url', 'Website'], ['username', 'Username'], ['password', 'Password'], ['notes', 'Notes']];

function describe(v, key) {
  if (key === 'password') return v ? '•••••••• (hidden)' : '—';
  return v || '—';
}

// "Changed on another device": shows what differs and lets you keep yours, theirs, or both
export default function ConflictDialog({ conflict, onDone }) {
  const { resolveConflict } = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mine = conflict.mine.data || {};
  const theirs = conflict.theirs.data || {};
  const rows = FIELDS.filter(([k]) => (mine[k] || '') !== (theirs[k] || ''));
  const extraDiffers = JSON.stringify(mine.fields || []) !== JSON.stringify(theirs.fields || []);

  async function choose(choice) {
    setBusy(true); setError(null);
    try { await resolveConflict(conflict, choice); onDone?.(); } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Dialog
      wide
      title="Changed on another device"
      footer={<>
        <button type="button" className="v-btn" disabled={busy} onClick={() => choose('both')}>Keep both</button>
        <button type="button" className="v-btn" disabled={busy} onClick={() => choose('theirs')}>Keep the other version</button>
        <button type="button" className="v-btn primary" disabled={busy} onClick={() => choose('mine')} data-autofocus>Keep mine</button>
      </>}
    >
      <p className="v-sub" style={{ marginTop: 0, marginBottom: 14 }}>
        “{theirs.title || mine.title || 'This item'}” was saved somewhere else (at {fullDate(conflict.theirs.updatedAt)}) before your change reached the server.
        Nothing has been overwritten.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="v-table">
          <thead><tr><th scope="col">Field</th><th scope="col">Your change</th><th scope="col">Other device</th></tr></thead>
          <tbody>
            {rows.map(([k, label]) => (
              <tr key={k}>
                <th scope="row" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{label}</th>
                <td>{k === 'password' ? 'Different password' : describe(mine[k], k)}</td>
                <td>{k === 'password' ? 'Different password' : describe(theirs[k], k)}</td>
              </tr>
            ))}
            {extraDiffers && <tr><th scope="row" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Extra fields</th><td>Changed</td><td>Changed</td></tr>}
            {!rows.length && !extraDiffers && <tr><td colSpan={3}>Only the favourite or category differs.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="v-hint">“Keep both” saves yours as a separate item named “(my copy)”.</p>
      {error && <div className="v-error" role="alert">{error}</div>}
    </Dialog>
  );
}
