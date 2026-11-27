import { useState } from 'react';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import ItemAvatar from '../components/ItemAvatar.jsx';
import Dialog from '../components/Dialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { categoryById } from '../lib/categories.js';

const DAYS = 30;
const daysLeft = (deletedAt) => Math.max(0, Math.ceil(DAYS - (Date.now() - new Date(deletedAt).getTime()) / 86400000));

export default function TrashPage() {
  const { items, categories, restoreItem, purgeItem, ensureVerified } = useVault();
  const toast = useToast();
  const [purging, setPurging] = useState(null);
  const trashed = items.filter(i => i.deletedAt).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  async function restore(item) {
    try { await restoreItem(item.id); toast('Restored'); } catch (err) { toast(err.message); }
  }

  async function purge() {
    const item = purging;
    setPurging(null);
    try {
      await ensureVerified('Delete forever');
      await purgeItem(item.id);
      toast('Deleted forever');
    } catch (err) { if (err.message !== 'Cancelled') toast(err.message); }
  }

  return (
    <div className="v-narrow" style={{ margin: '0 auto' }}>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">Trash</h1>
          <p className="v-sub">Deleted items stay here for {DAYS} days, then they're removed for good.</p>
        </div>
      </div>
      <div className="v-panel">
        {trashed.length === 0 ? (
          <div className="v-empty"><Icon name="trash" size={30} /><div className="v-h2">Trash is empty</div></div>
        ) : (
          <ul className="v-list" style={{ padding: 6 }}>
            {trashed.map(item => (
              <li key={item.id} className="v-row" style={{ flexWrap: 'wrap' }}>
                <ItemAvatar item={item} category={categoryById(item.categoryId, categories)} />
                <span className="v-row-body">
                  <span className="v-row-title" style={{ display: 'block' }}>{item.data?.title || (item.broken ? "Can't decrypt" : 'Untitled')}</span>
                  <span className="v-row-sub tnum" style={{ display: 'block' }}>{daysLeft(item.deletedAt)} days left{item.pending ? ' · waiting to sync' : ''}</span>
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="v-btn" onClick={() => restore(item)}>Restore</button>
                  <button type="button" className="v-btn danger" onClick={() => setPurging(item)}>Delete forever</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {purging && (
        <Dialog
          title="Delete forever?"
          onClose={() => setPurging(null)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setPurging(null)}>Cancel</button>
            <button type="button" className="v-btn danger solid" onClick={purge} data-autofocus>Delete forever</button>
          </>}
        >
          <p className="v-sub" style={{ marginTop: 0 }}>“{purging.data?.title || 'Untitled'}” and its password history will be gone. This can't be undone.</p>
        </Dialog>
      )}
    </div>
  );
}
