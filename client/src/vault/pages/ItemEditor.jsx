import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVault, ConflictError } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import StrengthMeter from '../components/StrengthMeter.jsx';
import PasswordGenerator from '../components/PasswordGenerator.jsx';
import ConflictDialog from '../components/ConflictDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { BUILTIN_CATEGORIES, categoryById, fieldLabel } from '../lib/categories.js';

function emptyData(cat) {
  return {
    title: '', url: '', username: '', password: '', notes: '', favorite: false,
    fields: cat.template.map(t => ({ name: t.name, value: '', secret: !!t.secret })),
  };
}

export default function ItemEditor({ id, initialCategory = 'login', backTo }) {
  const { items, categories, createItem, updateItem, ensureVerified } = useVault();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? items.find(i => i.id === id) : null;

  const [categoryId, setCategoryId] = useState(existing?.categoryId || initialCategory);
  const cat = categoryById(categoryId, categories);
  const [data, setData] = useState(() => existing?.data ? structuredClone(existing.data) : emptyData(categoryById(initialCategory, categories)));
  const [showPw, setShowPw] = useState(false);
  const [generator, setGenerator] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [shownFields, setShownFields] = useState({});

  const allCats = useMemo(() => [...BUILTIN_CATEGORIES, ...categories.map(c => categoryById(c.id, categories))], [categories]);
  const set = (patch) => setData(d => ({ ...d, ...patch }));
  const setField = (i, patch) => setData(d => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));

  // A new item switching category picks up that category's field template (without losing what was typed)
  function changeCategory(next) {
    setCategoryId(next);
    if (existing) return;
    const nextCat = categoryById(next, categories);
    setData(d => {
      const typed = d.fields.filter(f => f.value);
      const names = new Set(typed.map(f => f.name));
      return { ...d, fields: [...typed, ...nextCat.template.filter(t => !names.has(t.name)).map(t => ({ name: t.name, value: '', secret: !!t.secret }))] };
    });
  }

  async function reveal(key, setter) {
    try { await ensureVerified('Show this secret'); setter(); } catch { /* cancelled */ }
  }

  async function save(e) {
    e.preventDefault();
    if (!data.title.trim()) { setError('Give it a name, for example the website or bank.'); return; }
    setSaving(true); setError(null);
    const clean = {
      ...data,
      title: data.title.trim(),
      url: data.url?.trim() || '',
      fields: (data.fields || []).filter(f => f.name.trim() || f.value).map(f => ({ ...f, name: f.name.trim() })),
    };
    try {
      if (existing) {
        await updateItem(existing.id, categoryId, clean);
        toast('Saved');
        navigate(backTo);
      } else {
        const newId = await createItem(categoryId, clean);
        toast('Saved to your vault');
        navigate(`/vault/item/${newId}`);
      }
    } catch (err) {
      if (err instanceof ConflictError) setConflict({ id: existing.id, mine: err.mine, theirs: err.theirs });
      else setError(err.message || String(err));
    } finally { setSaving(false); }
  }

  if (id && !existing) {
    return <div className="v-panel v-empty"><div className="v-h2">Item not found</div><Link className="v-btn" to="/vault">Back</Link></div>;
  }

  return (
    <form className="v-panel" onSubmit={save} noValidate>
      <div className="v-detail-head" style={{ paddingBottom: 6 }}>
        <Link to={backTo} className="v-btn icon ghost" aria-label="Cancel" style={{ marginLeft: -8 }}><Icon name="back" /></Link>
        <h1 className="v-detail-title" style={{ flex: 1, alignSelf: 'center' }}>{existing ? 'Edit item' : 'New item'}</h1>
      </div>

      <div className="v-section" style={{ paddingTop: 10 }}>
        <div className="v-field">
          <label className="v-label" htmlFor="ed-cat">Category</label>
          <select id="ed-cat" className="v-select" value={categoryId} onChange={e => changeCategory(e.target.value)}>
            {allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="v-field">
          <label className="v-label" htmlFor="ed-title">Name</label>
          <input id="ed-title" className="v-input" value={data.title} onChange={e => set({ title: e.target.value })} placeholder={cat.id === 'card' ? 'e.g. HDFC credit card' : cat.id === 'wifi' ? 'e.g. Home Wi-Fi' : 'e.g. GitHub'} autoFocus={!existing} maxLength={120} aria-invalid={!!error && !data.title.trim()} />
        </div>

        {cat.standard.includes('url') && (
          <div className="v-field">
            <label className="v-label" htmlFor="ed-url">{fieldLabel(cat, 'url')}</label>
            <input id="ed-url" className="v-input" type="url" inputMode="url" value={data.url || ''} onChange={e => set({ url: e.target.value })} placeholder="https://" autoComplete="off" spellCheck={false} />
          </div>
        )}

        {cat.standard.includes('username') && (
          <div className="v-field">
            <label className="v-label" htmlFor="ed-user">{fieldLabel(cat, 'username')}</label>
            <input id="ed-user" className="v-input" value={data.username || ''} onChange={e => set({ username: e.target.value })} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </div>
        )}

        {cat.standard.includes('password') && (
          <div className="v-field">
            <label className="v-label" htmlFor="ed-pw">{fieldLabel(cat, 'password')}</label>
            <div className="v-input-group">
              <input id="ed-pw" className="v-input mono" type={showPw ? 'text' : 'password'} value={data.password || ''} onChange={e => set({ password: e.target.value })} autoComplete="new-password" spellCheck={false} />
              <button type="button" className="v-btn icon" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => (showPw ? setShowPw(false) : reveal('pw', () => setShowPw(true)))}>
                <Icon name={showPw ? 'eyeOff' : 'eye'} />
              </button>
              <button type="button" className="v-btn icon" aria-label="Generate a password" onClick={() => setGenerator(true)}><Icon name="dice" /></button>
            </div>
            <StrengthMeter password={data.password || ''} userInputs={[data.title, data.username].filter(Boolean)} />
          </div>
        )}

        <div className="v-field">
          <span className="v-label">Extra fields</span>
          {(data.fields || []).map((f, i) => (
            <div className="v-cf" key={i}>
              <input className="v-input v-cf-name" aria-label={`Field ${i + 1} name`} placeholder="Name" value={f.name} onChange={e => setField(i, { name: e.target.value })} maxLength={60} />
              <input
                className={`v-input${f.secret ? ' mono' : ''}`} aria-label={`${f.name || `Field ${i + 1}`} value`} placeholder="Value"
                type={f.secret && !shownFields[i] ? 'password' : 'text'} value={f.value} autoComplete="off" spellCheck={false}
                onChange={e => setField(i, { value: e.target.value })}
              />
              <button
                type="button" className="v-btn icon" aria-pressed={f.secret}
                aria-label={f.secret ? `${f.name || 'Field'} is secret. Make it visible` : `Mark ${f.name || 'field'} as secret`}
                title={f.secret ? 'Secret (masked)' : 'Visible'}
                onClick={() => (f.secret && !shownFields[i] ? reveal(i, () => setShownFields(s => ({ ...s, [i]: true }))) : setField(i, { secret: !f.secret }))}
              >
                <Icon name={f.secret ? (shownFields[i] ? 'eye' : 'lock') : 'unlock'} />
              </button>
              <button type="button" className="v-btn icon ghost" aria-label={`Remove ${f.name || 'field'}`} onClick={() => setData(d => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }))}>
                <Icon name="close" />
              </button>
            </div>
          ))}
          <button type="button" className="v-btn" onClick={() => setData(d => ({ ...d, fields: [...(d.fields || []), { name: '', value: '', secret: true }] }))}>
            <Icon name="plus" size={16} /> Add a field
          </button>
          <p className="v-hint">The lock icon masks a field until you choose to show it.</p>
        </div>

        <div className="v-field">
          <label className="v-label" htmlFor="ed-notes">Notes</label>
          <textarea id="ed-notes" className="v-textarea" value={data.notes || ''} onChange={e => set({ notes: e.target.value })} maxLength={20000} />
        </div>

        <label className="v-check"><input type="checkbox" checked={!!data.favorite} onChange={e => set({ favorite: e.target.checked })} /> Favourite</label>

        {error && <div className="v-error" role="alert">{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <Link to={backTo} className="v-btn">Cancel</Link>
          <button type="submit" className="v-btn primary" disabled={saving}>{saving ? 'Encrypting…' : 'Save'}</button>
        </div>
      </div>

      {generator && (
        <PasswordGenerator onClose={() => setGenerator(false)} onUse={(pw) => { set({ password: pw }); setGenerator(false); setShowPw(true); }} />
      )}
      {conflict && (
        <ConflictDialog conflict={conflict} onDone={() => { setConflict(null); navigate(backTo); }} />
      )}
    </form>
  );
}
