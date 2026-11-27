import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import ItemAvatar from '../components/ItemAvatar.jsx';
import ItemDetail from './ItemDetail.jsx';
import ItemEditor from './ItemEditor.jsx';
import { BUILTIN_CATEGORIES, categoryById } from '../lib/categories.js';
import { hostOf } from '../lib/format.js';

// Punctuation-blind as well, so "wifi" finds "Wi-Fi" and "gmailcom" finds "gmail.com"
const loose = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function matches(item, q, cat) {
  if (!q) return true;
  const d = item.data || {};
  const lq = loose(q);
  return [d.title, d.url, d.username, cat.name, ...(d.fields || []).filter(f => !f.secret).map(f => f.value)]
    .some(v => v && (String(v).toLowerCase().includes(q) || (lq && loose(String(v)).includes(lq))));
}

export default function ItemsPage({ mode = 'list' }) {
  const { items, categories } = useVault();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const filter = params.get('c') || 'all';

  const live = useMemo(() => items.filter(i => !i.deletedAt), [items]);
  const allCats = useMemo(() => [...BUILTIN_CATEGORIES, ...categories.map(c => categoryById(c.id, categories))], [categories]);

  const counts = useMemo(() => {
    const c = { all: live.length, fav: live.filter(i => i.data?.favorite).length };
    for (const i of live) c[i.categoryId] = (c[i.categoryId] || 0) + 1;
    return c;
  }, [live]);

  // Local search only: the server never sees titles or the query
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live
      .filter(i => filter === 'all' || (filter === 'fav' ? i.data?.favorite : i.categoryId === filter))
      .filter(i => matches(i, q, categoryById(i.categoryId, categories)))
      .sort((a, b) => (b.data?.favorite ? 1 : 0) - (a.data?.favorite ? 1 : 0) || (a.data?.title || '').localeCompare(b.data?.title || '', undefined, { sensitivity: 'base' }));
  }, [live, filter, query, categories]);

  const setFilter = (c) => setParams(c === 'all' ? {} : { c }, { replace: true });
  const showDetail = mode !== 'list';
  const qs = filter !== 'all' ? `?c=${filter}` : '';
  const newCategory = BUILTIN_CATEGORIES.some(c => c.id === filter) || categories.some(c => c.id === filter) ? filter : 'login';

  return (
    <div className="v-split" data-detail={showDetail}>
      <section className="v-panel v-list-pane" aria-label="Vault items">
        <div className="v-list-tools">
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="v-input-group" style={{ flex: 1 }}>
              <span style={{ display: 'grid', placeItems: 'center', paddingLeft: 11, color: 'var(--text-dim)' }}><Icon name="search" size={17} /></span>
              <input
                className="v-input" type="search" placeholder="Search your vault" aria-label="Search your vault"
                value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false}
              />
            </div>
            <button type="button" className="v-btn primary" onClick={() => navigate(`/vault/new?category=${newCategory}${qs ? `&c=${filter}` : ''}`)}>
              <Icon name="plus" size={17} /> <span>New</span>
            </button>
          </div>
          <div className="v-chips" role="group" aria-label="Filter by category">
            <button type="button" className="v-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span className="tnum">{counts.all}</span></button>
            <button type="button" className="v-chip" aria-pressed={filter === 'fav'} onClick={() => setFilter('fav')}><Icon name="star" size={14} /> Favourites</button>
            {allCats.map(c => (
              <button key={c.id} type="button" className="v-chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
                <Icon name={c.icon} size={14} /> {c.name}{counts[c.id] ? <span className="tnum" style={{ opacity: .7 }}> {counts[c.id]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="v-empty">
            <Icon name={query ? 'search' : 'key'} size={30} />
            <div className="v-h2">{query ? 'Nothing matches' : live.length ? 'Nothing in this category' : 'Your vault is empty'}</div>
            <div style={{ maxWidth: 260 }}>
              {query ? 'Search looks at names, websites and usernames.' : 'Add a login, card, Wi-Fi password or API key. Or import from your browser in Settings.'}
            </div>
            {!query && (
              <button type="button" className="v-btn primary" style={{ marginTop: 6 }} onClick={() => navigate(`/vault/new?category=${newCategory}`)}>
                <Icon name="plus" size={17} /> Add the first one
              </button>
            )}
          </div>
        ) : (
          <ul className="v-list">
            {visible.map(item => {
              const cat = categoryById(item.categoryId, categories);
              const d = item.data || {};
              return (
                <li key={item.id}>
                  <Link to={`/vault/item/${item.id}${qs}`} className="v-row" aria-current={item.id === id ? 'true' : undefined}>
                    <ItemAvatar item={item} category={cat} />
                    <span className="v-row-body">
                      <span className="v-row-title" style={{ display: 'block' }}>{item.broken ? "Can't decrypt this item" : d.title || 'Untitled'}</span>
                      <span className="v-row-sub" style={{ display: 'block' }}>
                        {item.broken ? 'It may have been changed on the server' : d.username || hostOf(d.url) || cat.name}
                      </span>
                    </span>
                    <span className="v-row-flags">
                      {item.pending && <span className="v-dot" title="Waiting to sync" aria-label="Waiting to sync" />}
                      {d.rotateReminder && <Icon name="warning" size={15} title="Change this password" />}
                      {item.shareCount > 0 && <Icon name="users" size={15} title={`Shared with ${item.shareCount}`} />}
                      {d.favorite && <span className="fav"><Icon name="star" size={15} title="Favourite" /></span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="v-detail-pane" aria-label="Item">
        {mode === 'list' && (
          <div className="v-panel v-empty" style={{ minHeight: 420 }}>
            <Icon name="lock" size={30} />
            <div className="v-h2">Select an item</div>
            <div>Passwords stay hidden until you choose to show or copy one.</div>
          </div>
        )}
        {mode === 'view' && <ItemDetail key={id} id={id} backTo={`/vault${qs}`} />}
        {mode === 'edit' && <ItemEditor key={`e-${id}`} id={id} backTo={`/vault/item/${id}${qs}`} />}
        {mode === 'new' && <ItemEditor key={`n-${params.get('category')}`} initialCategory={params.get('category') || 'login'} backTo={`/vault${qs}`} />}
      </section>
    </div>
  );
}
