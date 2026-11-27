import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import ItemAvatar from '../components/ItemAvatar.jsx';
import SecretField from '../components/SecretField.jsx';
import Dialog from '../components/Dialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { categoryById, fieldLabel } from '../lib/categories.js';
import { timeAgo, hostOf } from '../lib/format.js';

export default function SharedPage() {
  const { shared, leaveShare, reloadShared, offline } = useVault();
  const { shareId } = useParams();
  const toast = useToast();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const current = shared.find(s => s.shareId === shareId);
  const sorted = [...shared].sort((a, b) => (a.data?.title || '').localeCompare(b.data?.title || ''));

  async function refresh() {
    setRefreshing(true);
    try { await reloadShared(); } catch (err) { toast(err.message); } finally { setRefreshing(false); }
  }

  return (
    <div className="v-split" data-detail={!!shareId}>
      <section className="v-panel v-list-pane" aria-label="Shared with me">
        <div className="v-list-tools" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="v-h2" style={{ margin: 0 }}>Shared with me</h1>
            <div className="v-hint" style={{ marginTop: 2 }}>Read-only. The owner keeps them up to date.</div>
          </div>
          <button type="button" className="v-btn icon" onClick={refresh} disabled={refreshing || offline} aria-label="Refresh"><Icon name="refresh" /></button>
        </div>
        {sorted.length === 0 ? (
          <div className="v-empty">
            <Icon name="users" size={30} />
            <div className="v-h2">Nothing shared with you yet</div>
            <div style={{ maxWidth: 280 }}>When someone shares a login with you, it shows up here, encrypted for your vault only.</div>
          </div>
        ) : (
          <ul className="v-list">
            {sorted.map(s => {
              const cat = categoryById(s.categoryId);
              return (
                <li key={s.shareId}>
                  <Link to={`/vault/shared/${s.shareId}`} className="v-row" aria-current={s.shareId === shareId ? 'true' : undefined}>
                    <ItemAvatar item={s} category={cat} />
                    <span className="v-row-body">
                      <span className="v-row-title" style={{ display: 'block' }}>{s.broken ? "Can't open this item" : s.data?.title || 'Untitled'}</span>
                      <span className="v-row-sub" style={{ display: 'block' }}>From @{s.ownerUsername}{s.data?.url ? ` · ${hostOf(s.data.url)}` : ''}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="v-detail-pane">
        {!current ? (
          <div className="v-panel v-empty" style={{ minHeight: 360 }}>
            <Icon name="users" size={30} />
            <div className="v-h2">{shareId ? 'No longer shared with you' : 'Select an item'}</div>
          </div>
        ) : current.broken ? (
          <div className="v-panel v-section">
            <div className="v-banner danger"><Icon name="warning" /><span><strong>This item can't be opened.</strong> It was encrypted for an older key of your vault, or changed on the server. Ask @{current.ownerUsername} to share it again.</span></div>
            <button type="button" className="v-btn" style={{ marginTop: 14 }} onClick={() => setConfirmLeave(true)}>Remove from my list</button>
          </div>
        ) : (
          <article className="v-panel">
            <div className="v-detail-head">
              <Link to="/vault/shared" className="v-btn icon ghost v-only-narrow" aria-label="Back" style={{ marginLeft: -8 }}><Icon name="back" /></Link>
              <ItemAvatar item={current} category={categoryById(current.categoryId)} className="v-detail-icon" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 className="v-detail-title">{current.data.title || 'Untitled'}</h1>
                <div className="v-detail-meta">Shared by @{current.ownerUsername} {timeAgo(current.sharedAt)} · updated {timeAgo(current.updatedAt)}</div>
              </div>
            </div>
            <div className="v-fields">
              {(() => {
                const cat = categoryById(current.categoryId);
                const d = current.data;
                return (
                  <>
                    <SecretField label={fieldLabel(cat, 'url')} value={d.url} link />
                    <SecretField label={fieldLabel(cat, 'username')} value={d.username} />
                    <SecretField label={fieldLabel(cat, 'password')} value={d.password} secret />
                    {(d.fields || []).map((f, i) => <SecretField key={i} label={f.name || 'Field'} value={f.value} secret={f.secret} />)}
                    {d.notes && <SecretField label="Notes" value={d.notes} multiline />}
                  </>
                );
              })()}
            </div>
            <div className="v-section" style={{ borderTop: '1px solid var(--border-faint)' }}>
              <button type="button" className="v-btn" onClick={() => setConfirmLeave(true)}>Remove from my list</button>
            </div>
          </article>
        )}
      </section>

      {confirmLeave && current && (
        <Dialog
          title="Remove from your list?"
          onClose={() => setConfirmLeave(false)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setConfirmLeave(false)}>Cancel</button>
            <button type="button" className="v-btn danger solid" onClick={async () => { await leaveShare(current.shareId); setConfirmLeave(false); toast('Removed'); }} data-autofocus>Remove</button>
          </>}
        >
          <p className="v-sub" style={{ marginTop: 0 }}>You'll lose access. @{current.ownerUsername} would have to share it again.</p>
        </Dialog>
      )}
    </div>
  );
}
