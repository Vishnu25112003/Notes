import { useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useVault } from '../../VaultContext.jsx';
import Icon from '../../components/Icon.jsx';
import Dialog from '../../components/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import { parseCsv, detectAndMap, toCsv } from '../../lib/csv.js';
import { buildBackup, readBackupFile, openBackup } from '../../lib/backup.js';
import { offlineStore } from '../../lib/offlineStore.js';
import { categoryById } from '../../lib/categories.js';
import { vaultApi } from '../../../api/vault.js';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ImportExport() {
  const { username } = useAuth();
  const { items, categories, createItem, saveCategory, meta, getRecords, forceVerify, duringCeremony, offline } = useVault();
  const toast = useToast();
  const csvInput = useRef(null);
  const backupInput = useRef(null);
  const [preview, setPreview] = useState(null);     // { source, items }
  const [backup, setBackup] = useState(null);       // parsed backup awaiting its password
  const [backupSecret, setBackupSecret] = useState({ mode: 'password', value: '' });
  const [restored, setRestored] = useState(null);   // { items, categories, failed }
  const [progress, setProgress] = useState(null);
  const [plainWarn, setPlainWarn] = useState(false);
  const [error, setError] = useState(null);

  // File pickers hide the page on phones; keep the vault open while one is up
  const pick = (ref) => duringCeremony(() => new Promise(resolve => {
    const input = ref.current;
    const done = () => { window.removeEventListener('focus', done); setTimeout(resolve, 800); };
    window.addEventListener('focus', done);
    input.click();
  }));

  async function onCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const mapped = detectAndMap(parseCsv(await file.text()));
      setPreview({ ...mapped, items: mapped.items.filter(i => i.data.title || i.data.password || i.data.notes) });
    } catch (err) { setError(err.message); }
  }

  async function importItems(list, label) {
    setProgress({ done: 0, total: list.length });
    let n = 0;
    for (const it of list) {
      await createItem(it.categoryId, { favorite: false, notes: '', fields: [], ...it.data });
      n++;
      setProgress({ done: n, total: list.length });
    }
    setProgress(null);
    toast(`${n} item${n === 1 ? '' : 's'} imported from ${label}`, 4000);
  }

  async function confirmCsvImport() {
    const p = preview;
    setPreview(null);
    try { await importItems(p.items, p.source); } catch (err) { setError(err.message); setProgress(null); }
  }

  async function onBackupFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try { setBackup(readBackupFile(await file.text())); } catch (err) { setError(err.message); }
  }

  async function unlockBackup(e) {
    e.preventDefault();
    setError(null);
    try {
      const secret = backupSecret.mode === 'password' ? { password: backupSecret.value } : { recoveryKey: backupSecret.value };
      setRestored(await openBackup(backup, secret));
      setBackup(null); setBackupSecret({ mode: 'password', value: '' });
    } catch (err) { setError(err.message); }
  }

  async function confirmRestore() {
    const r = restored;
    setRestored(null);
    try {
      // Re-create custom categories by name, then re-encrypt every item under this vault's keys
      const map = {};
      for (const c of r.categories) {
        const existing = categories.find(x => x.name.toLowerCase() === c.name.toLowerCase());
        map[c.id] = existing ? existing.id : await saveCategory({ name: c.name, icon: c.icon, template: c.template });
      }
      await importItems(r.items.map(i => ({ ...i, categoryId: map[i.categoryId] || i.categoryId })), 'the backup');
    } catch (err) { setError(err.message); setProgress(null); }
  }

  async function exportBackup() {
    const cats = offline ? (await offlineStore.get(username, 'categories')) || [] : (await vaultApi.categories()).categories;
    const data = buildBackup({ username, meta, records: getRecords(), categories: cats });
    download(`notespace-vault-${username}-${today()}.nsvault`, JSON.stringify(data, null, 1), 'application/json');
    toast('Encrypted backup downloaded');
  }

  async function exportPlain() {
    setPlainWarn(false);
    try { await forceVerify('Export unencrypted passwords', { passwordOnly: true }); } catch { return; }
    const rows = [['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp']];
    for (const i of items.filter(x => !x.deletedAt && !x.broken)) {
      const d = i.data;
      const cat = categoryById(i.categoryId, categories);
      rows.push([
        cat.name, d.favorite ? '1' : '', i.categoryId === 'note' && !d.password ? 'note' : 'login', d.title, d.notes || '',
        (d.fields || []).map(f => `${f.name}: ${f.value}`).join('\n'), '0', d.url || '', d.username || '', d.password || '', '',
      ]);
    }
    download(`notespace-vault-UNENCRYPTED-${today()}.csv`, toCsv(rows), 'text/csv');
    toast('CSV downloaded. Delete it as soon as you are done.', 5000);
  }

  return (
    <>
      <div className="v-section">
        <h2 className="v-h2">Import</h2>
        <p className="v-hint" style={{ marginTop: 0 }}>From a password CSV exported by Chrome, Edge, Firefox or Bitwarden, or from a Notespace backup. Everything is encrypted on this device before upload.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="v-btn" disabled={!!progress || offline} onClick={() => pick(csvInput)}><Icon name="upload" size={16} /> Import CSV</button>
          <button type="button" className="v-btn" disabled={!!progress || offline} onClick={() => pick(backupInput)}><Icon name="upload" size={16} /> Restore backup</button>
          <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={onCsv} />
          <input ref={backupInput} type="file" accept=".nsvault,application/json" hidden onChange={onBackupFile} />
        </div>
        {progress && <p className="v-hint tnum" role="status">Encrypting and uploading {progress.done} of {progress.total}…</p>}
      </div>

      <div className="v-section">
        <h2 className="v-h2">Export</h2>
        <p className="v-hint" style={{ marginTop: 0 }}>The encrypted backup is safe to keep anywhere; it opens with your master password or recovery key. The CSV is plain text.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="v-btn" onClick={exportBackup}><Icon name="download" size={16} /> Encrypted backup</button>
          <button type="button" className="v-btn danger" onClick={() => setPlainWarn(true)}><Icon name="download" size={16} /> Unencrypted CSV</button>
        </div>
      </div>
      {error && <div className="v-error" role="alert" style={{ padding: '0 20px 16px', margin: 0 }}>{error}</div>}

      {preview && (
        <Dialog
          wide title={`Import ${preview.items.length} items from ${preview.source}?`} onClose={() => setPreview(null)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setPreview(null)}>Cancel</button>
            <button type="button" className="v-btn primary" onClick={confirmCsvImport} data-autofocus disabled={!preview.items.length}>Encrypt and import</button>
          </>}
        >
          <div style={{ maxHeight: 320, overflow: 'auto', margin: '8px 0' }}>
            <table className="v-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Username</th><th scope="col">Password</th></tr></thead>
              <tbody>
                {preview.items.slice(0, 200).map((i, n) => (
                  <tr key={n}><td>{i.data.title}</td><td>{i.data.username}</td><td>{i.data.password ? '••••••••' : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.items.length > 200 && <p className="v-hint">And {preview.items.length - 200} more.</p>}
          <div className="v-banner"><Icon name="warning" /><span>After importing, delete the CSV file from your Downloads and empty the bin. It holds every password in plain text.</span></div>
        </Dialog>
      )}

      {backup && (
        <Dialog title="Open the backup" onClose={() => setBackup(null)}>
          <p className="v-sub" style={{ marginTop: 0, marginBottom: 14 }}>
            Backup of @{backup.account} from {new Date(backup.exportedAt).toLocaleDateString()} with {backup.items.length} items.
            Use the master password or recovery key from when it was made.
          </p>
          <form onSubmit={unlockBackup}>
            <div className="v-chips" style={{ marginBottom: 12 }}>
              <button type="button" className="v-chip" aria-pressed={backupSecret.mode === 'password'} onClick={() => setBackupSecret({ mode: 'password', value: '' })}>Master password</button>
              <button type="button" className="v-chip" aria-pressed={backupSecret.mode === 'recovery'} onClick={() => setBackupSecret({ mode: 'recovery', value: '' })}>Recovery key</button>
            </div>
            <input
              className={`v-input${backupSecret.mode === 'recovery' ? ' mono' : ''}`} type={backupSecret.mode === 'password' ? 'password' : 'text'}
              aria-label={backupSecret.mode === 'password' ? 'Master password of the backup' : 'Recovery key of the backup'}
              value={backupSecret.value} onChange={e => setBackupSecret(s => ({ ...s, value: e.target.value }))} autoComplete="off" data-autofocus
            />
            {error && <div className="v-error" role="alert">{error}</div>}
            <div className="v-dialog-foot">
              <button type="button" className="v-btn" onClick={() => setBackup(null)}>Cancel</button>
              <button type="submit" className="v-btn primary" disabled={!backupSecret.value}>Open</button>
            </div>
          </form>
        </Dialog>
      )}

      {restored && (
        <Dialog
          title={`Restore ${restored.items.length} items?`} onClose={() => setRestored(null)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setRestored(null)}>Cancel</button>
            <button type="button" className="v-btn primary" onClick={confirmRestore} data-autofocus>Add to my vault</button>
          </>}
        >
          <p className="v-sub" style={{ marginTop: 0 }}>
            They are added as new items next to what's already in your vault; nothing is overwritten.
            {restored.categories.length > 0 && ` ${restored.categories.length} custom categor${restored.categories.length === 1 ? 'y' : 'ies'} come along.`}
            {restored.failed > 0 && ` ${restored.failed} damaged item${restored.failed === 1 ? '' : 's'} will be skipped.`}
          </p>
        </Dialog>
      )}

      {plainWarn && (
        <Dialog
          title="Export without encryption?" onClose={() => setPlainWarn(false)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setPlainWarn(false)} data-autofocus>Cancel</button>
            <button type="button" className="v-btn danger solid" onClick={exportPlain}>I understand, export</button>
          </>}
        >
          <div className="v-banner danger" style={{ marginTop: 8 }}>
            <Icon name="warning" />
            <span><strong>Anyone who gets this file can read every password.</strong> It stays in Downloads, and may sync to cloud storage, until you delete it. Only do this to move to another password manager, then delete the file and empty the bin.</span>
          </div>
          <p className="v-hint">You'll be asked for your master password.</p>
        </Dialog>
      )}
    </>
  );
}
