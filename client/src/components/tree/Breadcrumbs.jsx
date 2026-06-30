import { Link } from 'react-router-dom';

export default function Breadcrumbs({ section, pages, currentPageId }) {
  const buildCrumbs = (pageId) => {
    if (!pageId) return [];
    const page = pages.find(p => String(p._id) === String(pageId));
    if (!page) return [];
    return [...buildCrumbs(page.parentId), page];
  };

  const crumbs = buildCrumbs(currentPageId);
  const sep = <span style={{ color: 'var(--separator)', margin: '0 2px' }}>/</span>;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
      <Link
        to="/sections"
        style={{ color: 'var(--text-dim)', textDecoration: 'none' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-mid)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
      >SECTIONS</Link>
      {sep}
      <Link
        to={`/sections/${section?._id}`}
        style={{ color: 'var(--text-dim)', textDecoration: 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-mid)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
      >
        {section?.title}
      </Link>
      {crumbs.map((p, i) => (
        <span key={p._id} style={{ display: 'flex', alignItems: 'center' }}>
          {sep}
          {i < crumbs.length - 1 ? (
            <Link
              to={`/sections/${section?._id}/pages/${p._id}`}
              style={{ color: 'var(--text-dim)', textDecoration: 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-mid)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >{p.title}</Link>
          ) : (
            <span style={{ color: 'var(--text)', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
