import { useState } from 'react';
import { useVault } from '../../VaultContext.jsx';
import Icon from '../../components/Icon.jsx';
import Dialog from '../../components/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import { BUILTIN_CATEGORIES, CATEGORY_ICONS } from '../../lib/categories.js';

function CategoryForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || 'tag');
  const [template, setTemplate] = useState(initial?.template?.length ? initial.template : [{ name: '', secret: false }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Give the category a name.'); return; }
    setBusy(true); setError(null);
    try { await onSave({ ...initial, name, icon, template: template.filter(t => t.name.trim()).map(t => ({ name: t.name.trim(), secret: t.secret })) }); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Dialog title={initial ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="v-field" style={{ marginTop: 8 }}>
          <label className="v-label" htmlFor="cat-name">Name</label>
          <input id="cat-name" className="v-input" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. Government IDs" data-autofocus />
        </div>
        <div className="v-field">
          <span className="v-label">Icon</span>
          <div className="v-chips" style={{ flexWrap: 'wrap' }} role="radiogroup" aria-label="Icon">
            {CATEGORY_ICONS.map(i => (
              <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} className="v-chip" aria-pressed={icon === i} onClick={() => setIcon(i)} style={{ padding: '6px 9px' }}>
                <Icon name={i} size={17} />
              </button>
            ))}
          </div>
        </div>
        <div className="v-field">
          <span className="v-label">Fields every new item starts with</span>
          {template.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="v-input" aria-label={`Field ${i + 1} name`} placeholder="Field name" value={t.name} maxLength={60} onChange={e => setTemplate(ts => ts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <label className="v-check" style={{ whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={t.secret} onChange={e => setTemplate(ts => ts.map((x, j) => (j === i ? { ...x, secret: e.target.checked } : x)))} /> Secret
              </label>
              <button type="button" className="v-btn icon ghost" aria-label={`Remove field ${i + 1}`} onClick={() => setTemplate(ts => ts.filter((_, j) => j !== i))}><Icon name="close" /></button>
            </div>
          ))}
          <button type="button" className="v-btn" onClick={() => setTemplate(ts => [...ts, { name: '', secret: false }])}><Icon name="plus" size={16} /> Add a field</button>
          <p className="v-hint">Items in custom categories also get website, username and password.</p>
        </div>
        {error && <div className="v-error" role="alert">{error}</div>}
        <div className="v-dialog-foot">
          <button type="button" className="v-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="v-btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function CategoriesEditor() {
  const { categories, items, saveCategory, deleteCategory, offline } = useVault();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [deleting, setDeleting] = useState(null);
  const count = (id) => items.filter(i => i.categoryId === id && !i.deletedAt).length;

  return (
    <div className="v-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="v-h2">Categories</h2>
          <p className="v-hint" style={{ marginTop: 0 }}>The four built-in ones can't be changed. Add your own with their own fields; names are encrypted too.</p>
        </div>
        <button type="button" className="v-btn" onClick={() => setEditing('new')} disabled={offline}><Icon name="plus" size={16} /> New</button>
      </div>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {BUILTIN_CATEGORIES.map(c => (
          <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            <Icon name={c.icon} size={17} /> <span style={{ flex: 1 }}>{c.name}</span> <span className="tnum v-hint" style={{ margin: 0 }}>{count(c.id)}</span>
          </li>
        ))}
        {categories.map(c => (
          <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 14, color: 'var(--text)' }}>
            <Icon name={c.icon} size={17} /> <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
            <span className="tnum v-hint" style={{ margin: 0 }}>{count(c.id)}</span>
            <button type="button" className="v-btn icon ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} disabled={offline}><Icon name="edit" size={16} /></button>
            <button type="button" className="v-btn icon ghost" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)} disabled={offline}><Icon name="trash" size={16} /></button>
          </li>
        ))}
      </ul>

      {editing && (
        <CategoryForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (cat) => { await saveCategory(cat); setEditing(null); toast('Category saved'); }}
        />
      )}
      {deleting && (
        <Dialog
          title={`Delete “${deleting.name}”?`} onClose={() => setDeleting(null)}
          footer={<>
            <button type="button" className="v-btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button type="button" className="v-btn danger solid" data-autofocus onClick={async () => { const c = deleting; setDeleting(null); try { await deleteCategory(c.id); toast('Category deleted'); } catch (err) { toast(err.message); } }}>Delete category</button>
          </>}
        >
          <p className="v-sub" style={{ marginTop: 0 }}>Its {count(deleting.id)} item{count(deleting.id) === 1 ? '' : 's'} move to “API key / Secure note”. Nothing is deleted.</p>
        </Dialog>
      )}
    </div>
  );
}
