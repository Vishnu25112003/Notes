import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVault } from '../VaultContext.jsx';
import Icon from '../components/Icon.jsx';
import ItemAvatar from '../components/ItemAvatar.jsx';
import { checkStrength } from '../crypto/strength.js';
import { breachCount } from '../lib/hibp.js';
import { categoryById } from '../lib/categories.js';
import { daysSince, timeAgo } from '../lib/format.js';

function Group({ title, hint, items, categories, render, empty }) {
  return (
    <section className="v-panel" style={{ marginBottom: 16 }}>
      <div className="v-section" style={{ paddingBottom: 10 }}>
        <h2 className="v-h2">{title} <span className="tnum" style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{items.length}</span></h2>
        <p className="v-hint" style={{ margin: 0 }}>{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="v-hint" style={{ padding: '0 20px 18px', margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}><Icon name="check" size={16} /> {empty}</p>
      ) : (
        <ul className="v-list" style={{ padding: '0 6px 6px' }}>
          {items.map(({ item, note }) => (
            <li key={item.id}>
              <Link to={`/vault/item/${item.id}`} className="v-row">
                <ItemAvatar item={item} category={categoryById(item.categoryId, categories)} />
                <span className="v-row-body">
                  <span className="v-row-title" style={{ display: 'block' }}>{item.data.title || 'Untitled'}</span>
                  <span className="v-row-sub" style={{ display: 'block' }}>{render ? render(item) : note}</span>
                </span>
                <Icon name="back" size={16} className="v-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HealthPage() {
  const { items, categories, offline, ensureVerified } = useVault();
  const withPw = useMemo(() => items.filter(i => !i.deletedAt && !i.broken && i.data?.password), [items]);
  const [scores, setScores] = useState({});
  const [breaches, setBreaches] = useState(null);
  const [checking, setChecking] = useState(false);
  const [breachError, setBreachError] = useState(null);

  // Strength runs locally with zxcvbn; nothing leaves the device
  useEffect(() => {
    let live = true;
    (async () => {
      const out = {};
      for (const i of withPw) out[i.id] = (await checkStrength(i.data.password, [i.data.title, i.data.username].filter(Boolean))).score;
      if (live) setScores(out);
    })();
    return () => { live = false; };
  }, [withPw]);

  const reused = useMemo(() => {
    const byPw = new Map();
    for (const i of withPw) byPw.set(i.data.password, [...(byPw.get(i.data.password) || []), i]);
    return withPw.filter(i => byPw.get(i.data.password).length > 1).map(i => ({ item: i, note: `Same password as ${byPw.get(i.data.password).length - 1} other item${byPw.get(i.data.password).length > 2 ? 's' : ''}` }));
  }, [withPw]);

  const weak = withPw.filter(i => scores[i.id] !== undefined && scores[i.id] < 3).map(i => ({ item: i, note: ['Very weak', 'Weak', 'Fair'][scores[i.id]] }));
  const old = withPw.filter(i => daysSince(i.data.passwordChangedAt || i.createdAt) > 365).map(i => ({ item: i, note: `Last changed ${timeAgo(i.data.passwordChangedAt || i.createdAt)}` }));
  const reminders = items.filter(i => !i.deletedAt && i.data?.rotateReminder).map(i => ({ item: i, note: 'You stopped sharing this. Change the password.' }));

  async function runBreachCheck() {
    setBreachError(null);
    try { await ensureVerified('Check passwords against known breaches'); } catch { return; }
    setChecking(true);
    try {
      // One request per distinct password; each sends only a 5-character hash prefix
      const unique = [...new Set(withPw.map(i => i.data.password))];
      const counts = new Map();
      for (const pw of unique) counts.set(pw, await breachCount(pw));
      setBreaches(withPw.filter(i => counts.get(i.data.password) > 0).map(i => ({ item: i, note: `Seen ${counts.get(i.data.password).toLocaleString()} times in data breaches` })));
    } catch (err) {
      setBreachError(err.message === 'Failed to fetch' ? "Couldn't reach the breach database." : err.message);
    } finally { setChecking(false); }
  }

  const score = withPw.length ? Math.round(100 * (1 - new Set([...weak, ...reused, ...old, ...(breaches || [])].map(x => x.item.id)).size / withPw.length)) : null;

  return (
    <div className="v-narrow" style={{ margin: '0 auto' }}>
      <div className="v-page-head">
        <div>
          <h1 className="v-h1">Password health</h1>
          <p className="v-sub">
            {withPw.length === 0 ? 'Add some logins to see how they hold up.'
              : `${score}% of your ${withPw.length} passwords have no known problems.`}
          </p>
        </div>
      </div>

      <section className="v-panel" style={{ marginBottom: 16 }}>
        <div className="v-section" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 className="v-h2">Breach check</h2>
            <p className="v-hint" style={{ margin: 0 }}>
              Compares each password with Have I Been Pwned. Only the first 5 characters of a hash are sent, so the service never learns your passwords.
            </p>
          </div>
          <button type="button" className="v-btn primary" onClick={runBreachCheck} disabled={checking || offline || !withPw.length}>
            <Icon name="shield" size={16} /> {checking ? 'Checking…' : breaches ? 'Check again' : 'Check now'}
          </button>
        </div>
        {breachError && <div className="v-error" style={{ padding: '0 20px 16px', margin: 0 }} role="alert">{breachError}</div>}
      </section>

      {breaches && <Group title="Found in breaches" hint="Change these first. Attackers try them on every site." items={breaches} categories={categories} empty="None of your passwords appear in known breaches." />}
      {reminders.length > 0 && <Group title="Change after sharing" hint="You stopped sharing these items." items={reminders} categories={categories} empty="" />}
      <Group title="Reused" hint="One leak opens every account that shares the password." items={reused} categories={categories} empty="Every password is unique." />
      <Group title="Weak" hint="Easy to guess. Use the generator for a new one." items={weak} categories={categories} empty="No weak passwords." />
      <Group title="Old" hint="Not changed in over a year." items={old} categories={categories} empty="Everything changed in the last year." />
    </div>
  );
}
