import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import ItemAvatar from '../components/ItemAvatar.jsx';
import SecretField from '../components/SecretField.jsx';
import Dialog from '../components/Dialog.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { categoryById, fieldLabel } from '../lib/categories.js';
import { timeAgo, fullDate, daysSince } from '../lib/format.js';

export default function ItemDetail({ id, backTo }) {
  const { items, categories, updateItem, trashItem, ensureVerified } = useVault();
  const navigate = useNavigate();
  const toast = useToast();
  const item = items.find(i => i.id === id);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!item || item.deletedAt) {
    return (
      <div className="v-panel v-empty">
        <Icon name="search" size={30} />
        <div className="v-h2">{item?.deletedAt ? 'This item is in the trash' : 'Item not found'}</div>
        <Link to={item?.deletedAt ? '/vault/trash' : backTo} className="v-btn">{item?.deletedAt ? 'Open trash' : 'Back to the list'}</Link>
      </div>
    );
  }

  const cat = categoryById(item.categoryId, categories);
  const d = item.data || {};

  if (item.broken) {
    return (
      <div className="v-panel v-section">
        <div className="v-banner danger"><Icon name="warning" /><span><strong>This item can't be decrypted.</strong> Its ciphertext doesn't match its key, which happens if it was altered on the server. Nothing else in your vault is affected. You can move it to the trash.</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Link to={backTo} className="v-btn">Back</Link>
          <button type="button" className="v-btn danger" onClick={async () => { await trashItem(id); navigate(backTo); }}>Move to trash</button>
        </div>
      </div>
    );
  }

  const stale = d.password && daysSince(d.passwordChangedAt) > 365;

  async function toggleFavorite() {
    setBusy(true);
    try { await updateItem(id, item.categoryId, { ...d, favorite: !d.favorite }); } catch (err) { toast(err.message); } finally { setBusy(false); }
  }

  async function edit() {
    try { await ensureVerified('Edit this item'); navigate(`/vault/item/${id}/edit${backTo.includes('?') ? backTo.slice(backTo.indexOf('?')) : ''}`); } catch { /* cancelled */ }
  }

  async function openHistory() {
    try { await ensureVerified('Show password history'); setShowHistory(true); } catch { /* cancelled */ }
  }

  async function doTrash() {
    setConfirmTrash(false);
    try {
      await ensureVerified('Move this item to the trash');
      await trashItem(id);
      toast('Moved to trash. You can restore it for 30 days.');
      navigate(backTo);
    } catch (err) { if (err.message !== 'Cancelled') toast(err.message); }
  }

  return (
    <article className="v-panel">
      <div className="v-detail-head">
        <Link to={backTo} className="v-btn icon ghost v-only-narrow" aria-label="Back to the list" style={{ marginLeft: -8 }}><Icon name="back" /></Link>
        <ItemAvatar item={item} category={cat} className="v-detail-icon" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="v-detail-title">{d.title || 'Untitled'}</h1>
          <div className="v-detail-meta">
            {cat.name}
            {d.passwordChangedAt && <> · Password changed {timeAgo(d.passwordChangedAt)}</>}
            {item.pending && <> · Waiting to sync</>}
          </div>
        </div>
      </div>

      <div className="v-actions">
        <button type="button" className="v-btn" onClick={edit}><Icon name="edit" size={16} /> Edit</button>
        <button type="button" className="v-btn" onClick={toggleFavorite} disabled={busy} aria-pressed={!!d.favorite}>
          <Icon name="star" size={16} /> {d.favorite ? 'Favourite' : 'Add to favourites'}
        </button>
        <button type="button" className="v-btn" onClick={() => setSharing(true)}>
          <Icon name="share" size={16} /> Share{item.shareCount ? ` (${item.shareCount})` : ''}
        </button>
        {d.history?.length > 0 && (
          <button type="button" className="v-btn" onClick={openHistory}><Icon name="history" size={16} /> History</button>
        )}
        <button type="button" className="v-btn danger" onClick={() => setConfirmTrash(true)}><Icon name="trash" size={16} /> Delete</button>
      </div>

      {(d.rotateReminder || stale) && (
        <div style={{ padding: '0 22px 16px', display: 'grid', gap: 8 }}>
          {d.rotateReminder && (
            <div className="v-banner"><Icon name="warning" /><span><strong>Change this password.</strong> You stopped sharing it {timeAgo(d.rotateReminder.at)}, and the other person may have kept a copy. Change it on the site, then save the new one here.</span></div>
          )}
          {stale && !d.rotateReminder && (
            <div className="v-banner"><Icon name="history" /><span>This password is more than a year old. Consider changing it.</span></div>
          )}
        </div>
      )}

      <div className="v-fields">
        {cat.standard.includes('url') && <SecretField label={fieldLabel(cat, 'url')} value={d.url} link />}
        {cat.standard.includes('username') && <SecretField label={fieldLabel(cat, 'username')} value={d.username} />}
        {cat.standard.includes('password') && <SecretField label={fieldLabel(cat, 'password')} value={d.password} secret />}
        {(d.fields || []).map((f, i) => <SecretField key={i} label={f.name || 'Field'} value={f.value} secret={f.secret} />)}
        {d.notes && <SecretField label="Notes" value={d.notes} multiline />}
      </div>

      <div className="v-section" style={{ borderTop: '1px solid var(--border-faint)', fontSize: 12.5, color: 'var(--text-dim)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Created {fullDate(item.createdAt)}</span>
        <span>Updated {fullDate(item.updatedAt)}</span>
        <span className="tnum">Version {item.version}</span>
      </div>

      {showHistory && (
        <Dialog title="Password history" onClose={() => setShowHistory(false)}>
          <p className="v-sub" style={{ marginTop: 0, marginBottom: 8 }}>The last {d.history.length} passwords, newest first.</p>
          <div style={{ margin: '0 -22px' }}>
            {d.history.map((h, i) => <SecretField key={i} label={`Used until ${fullDate(h.changedAt)}`} value={h.password} secret />)}
          </div>
        </Dialog>
      )}

      {confirmTrash && (
        <Dialog
          title="Delete this item?"
          onClose={() => setConfirmTrash(false)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setConfirmTrash(false)}>Cancel</button>
            <button type="button" className="v-btn danger solid" onClick={doTrash} data-autofocus>Move to trash</button>
          </>}
        >
          <p className="v-sub" style={{ marginTop: 0 }}>
            “{d.title || 'Untitled'}” goes to the trash for 30 days, then it's deleted for good.
            {item.shareCount > 0 && ' People you shared it with lose access while it is in the trash.'}
          </p>
        </Dialog>
      )}

      {sharing && <ShareDialog item={item} onClose={() => setSharing(false)} />}
    </article>
  );
}
