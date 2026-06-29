import { Link } from 'react-router-dom';

export default function Breadcrumbs({ section, pages, currentPageId }) {
  const buildCrumbs = (pageId) => {
    if (!pageId) return [];
    const page = pages.find(p => String(p._id) === String(pageId));
    if (!page) return [];
    return [...buildCrumbs(page.parentId), page];
  };

  const crumbs = buildCrumbs(currentPageId);
  const sep = <span style={{ color: '#3a3a42', margin: '0 2px' }}>/</span>;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#7a7a85', flexWrap: 'wrap' }}>
      <Link
        to="/sections"
        style={{ color: '#7a7a85', textDecoration: 'none' }}
        onMouseEnter={e => e.currentTarget.style.color = '#c8c8d0'}
        onMouseLeave={e => e.currentTarget.style.color = '#7a7a85'}
      >SECTIONS</Link>
      {sep}
      <Link
        to={`/sections/${section?._id}`}
        style={{ color: '#7a7a85', textDecoration: 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onMouseEnter={e => e.currentTarget.style.color = '#c8c8d0'}
        onMouseLeave={e => e.currentTarget.style.color = '#7a7a85'}
      >
        {section?.title}
      </Link>
      {crumbs.map((p, i) => (
        <span key={p._id} style={{ display: 'flex', alignItems: 'center' }}>
          {sep}
          {i < crumbs.length - 1 ? (
            <Link
              to={`/sections/${section?._id}/pages/${p._id}`}
              style={{ color: '#7a7a85', textDecoration: 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c8c8d0'}
              onMouseLeave={e => e.currentTarget.style.color = '#7a7a85'}
            >{p.title}</Link>
          ) : (
            <span style={{ color: '#f4f4f6', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
