import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPage, deletePage, updatePage } from '../../api/pages.js';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import ActionMenu, { DotsIcon, PlusIcon, PencilIcon, ArrowUp, ArrowDown, TrashIcon } from '../common/ActionMenu.jsx';

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6"/>
  </svg>
);

const byOrder = (a, b) => a.order - b.order;
const sameParent = (a, b) => String(a.parentId || '') === String(b.parentId || '');

function NewPageModal({ onConfirm, onClose, context = '' }) {
  const [title, setTitle] = useState('');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 400,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 22,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <span style={{ color: 'var(--accent)' }}><DocIcon /></span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>New Page</span>
          {context && (
            <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-label)' }}>
              IN {context.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-label)', marginBottom: 7 }}>PAGE TITLE</div>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && title.trim() && onConfirm(title)}
          placeholder="Untitled"
          style={{
            width: '100%', background: 'var(--bg)',
            border: '1px solid var(--accent)', borderRadius: 8,
            padding: '11px 13px',
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: 'var(--text-2)',
            outline: 'none', display: 'block',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
          >CANCEL</button>
          <button
            onClick={() => title.trim() && onConfirm(title)}
            style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
          >CREATE</button>
        </div>
      </div>
    </div>
  );
}

function PageNode({ page, siblings, allPages, sectionId, currentPageId, depth = 0, onRefresh, onNewPage, onRenamed, reorder }) {
  const [open, setOpen] = useState(depth < 2);
  const [confirm, setConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(null); // non-null while renaming
  const menuButton = useRef(null);
  const navigate = useNavigate();
  const renaming = draftTitle !== null;

  const children = allPages.filter(p => String(p.parentId) === String(page._id)).sort(byOrder);
  const index = siblings.findIndex(p => p._id === page._id);
  const canReorder = Boolean(reorder) && siblings.length > 1;
  const { dragging, dropHint } = reorder || {};
  const isDragging = dragging?._id === page._id;
  const hint = dropHint?.id === page._id ? dropHint.pos : null;
  const isActive = String(page._id) === String(currentPageId);

  const handleDelete = async () => {
    await deletePage(page._id);
    onRefresh();
    navigate(`/sections/${sectionId}`);
  };

  // Closing the input can fire a late blur; this keeps that from saving twice or after Escape.
  const renameSettled = useRef(true);
  const startRename = () => { renameSettled.current = false; setDraftTitle(page.title); };
  const cancelRename = () => { renameSettled.current = true; setDraftTitle(null); };
  const saveRename = async () => {
    if (renameSettled.current) return;
    renameSettled.current = true;
    const title = draftTitle.trim();
    setDraftTitle(null);
    if (!title || title === page.title) return;
    await updatePage(page._id, { title });
    onRenamed(page._id, title);
  };

  const menuItems = [
    { label: 'New sub-page', icon: <PlusIcon />, onSelect: () => onNewPage(page._id, page.title) },
    { label: 'Rename', icon: <PencilIcon />, onSelect: startRename },
    ...(canReorder ? [
      { label: 'Move up', icon: <ArrowUp />, disabled: index === 0, onSelect: () => reorder.shift(siblings, index, -1) },
      { label: 'Move down', icon: <ArrowDown />, disabled: index === siblings.length - 1, onSelect: () => reorder.shift(siblings, index, 1) },
    ] : []),
    { label: 'Delete', icon: <TrashIcon />, danger: true, onSelect: () => setConfirm(true) },
  ];

  const indent = 8 + depth * 20;

  // A page can only be dropped among its own siblings (a.2 above a.1, never into b).
  const dropPosition = e => {
    if (!dragging || isDragging || !sameParent(dragging, page)) return null;
    const { top, height } = e.currentTarget.getBoundingClientRect();
    return e.clientY < top + height / 2 ? 'before' : 'after';
  };

  return (
    <div>
      <div
        draggable={canReorder && !renaming}
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', page.title);
          reorder.start(page);
        }}
        onDragEnd={() => reorder.end()}
        onDragOver={e => {
          const pos = dropPosition(e);
          if (!pos) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          reorder.hover(page._id, pos);
        }}
        onDrop={e => {
          const pos = dropPosition(e);
          if (!pos) return;
          e.preventDefault();
          reorder.drop(siblings, page._id, pos);
        }}
        style={{
          position: 'relative',
          userSelect: 'none',
          opacity: isDragging ? 0.4 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          paddingLeft: indent,
          paddingRight: 8,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: 6,
          cursor: 'pointer',
          background: isActive ? 'rgba(124,108,255,.16)' : 'transparent',
          color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--border-faint)'; e.currentTarget.style.color = 'var(--text-mid)'; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
        onClick={() => { if (!renaming) navigate(`/sections/${sectionId}/pages/${page._id}`); }}
      >
        {children.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : (
          <span style={{ width: 13 }} />
        )}
        <DocIcon />
        {renaming ? (
          <input
            autoFocus
            className="page-rename-input"
            aria-label="Page name"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onFocus={e => e.target.select()}
            onClick={e => e.stopPropagation()}
            onBlur={saveRename}
            onKeyDown={e => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') cancelRename();
            }}
          />
        ) : (
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isActive ? <strong>{page.title}</strong> : page.title}
          </span>
        )}
        {hint && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: indent, right: 6, height: 2, borderRadius: 1,
              background: 'var(--accent)', pointerEvents: 'none',
              ...(hint === 'before' ? { top: -1 } : { bottom: -1 }),
            }}
          />
        )}
        {!renaming && (
          <button
            ref={menuButton}
            type="button"
            className={menuOpen ? 'page-node-menu is-open' : 'page-node-menu'}
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            title="Page options"
            aria-label={`Options for ${page.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          ><DotsIcon vertical /></button>
        )}

      </div>

      {open && children.length > 0 && (
        <div>
          {children.map(child => (
            <PageNode
              key={child._id}
              page={child}
              siblings={children}
              reorder={reorder}
              onRenamed={onRenamed}
              allPages={allPages}
              sectionId={sectionId}
              currentPageId={currentPageId}
              depth={depth + 1}
              onRefresh={onRefresh}
              onNewPage={onNewPage}
            />
          ))}
        </div>
      )}

      {menuOpen && (
        <ActionMenu anchor={menuButton.current} items={menuItems} onClose={() => setMenuOpen(false)} />
      )}

      {confirm && (
        <ConfirmDialog
          title="Delete page?"
          message={`Delete "${page.title}" and all its sub-pages?`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

const ShareIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
  </svg>
);

export default function PageTreeSidebar({ pages, sectionId, currentPageId, onRefresh, onReorder, onRenamed, onCollapse, onShareSection, sectionPending = 0 }) {
  const navigate = useNavigate();
  const [newPageTarget, setNewPageTarget] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dropHint, setDropHint] = useState(null);
  const topLevel = pages.filter(p => !p.parentId).sort(byOrder);

  const commit = (siblings, ids) => {
    if (ids.every((id, i) => id === siblings[i]._id)) return;
    onReorder(siblings[0].parentId || null, ids);
  };

  const endDrag = () => { setDragging(null); setDropHint(null); };

  const reorder = onReorder && {
    dragging,
    dropHint,
    start: setDragging,
    end: endDrag,
    hover: (id, pos) => setDropHint(h => (h?.id === id && h.pos === pos ? h : { id, pos })),
    drop: (siblings, targetId, pos) => {
      const ids = siblings.map(p => p._id).filter(id => id !== dragging._id);
      ids.splice(ids.indexOf(targetId) + (pos === 'after' ? 1 : 0), 0, dragging._id);
      endDrag();
      commit(siblings, ids);
    },
    shift: (siblings, index, delta) => {
      const ids = siblings.map(p => p._id);
      const [moved] = ids.splice(index, 1);
      ids.splice(index + delta, 0, moved);
      commit(siblings, ids);
    },
  };

  const handleNewPage = (parentId, context = '') => {
    setNewPageTarget({ parentId: parentId || null, context });
  };

  const handleCreate = async (title) => {
    const { parentId } = newPageTarget;
    const page = await createPage({ sectionId, parentId, title });
    setNewPageTarget(null);
    onRefresh();
    navigate(`/sections/${sectionId}/pages/${page._id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 10px 10px 16px' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-label)' }}>PAGES</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onShareSection && (
          <button
            onClick={onShareSection}
            title="Share this whole section"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: '0.07em', color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-faint)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <ShareIcon /> SHARE
            {sectionPending > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 15, height: 15, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {sectionPending}
              </span>
            )}
          </button>
        )}
        {onCollapse && (
          <button
            type="button"
            className="sidebar-collapse"
            onClick={onCollapse}
            title="Minimize sidebar"
            aria-label="Minimize sidebar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M16 9.5 13.5 12l2.5 2.5"/>
            </svg>
          </button>
        )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
        {topLevel.map(page => (
          <PageNode
            key={page._id}
            page={page}
            siblings={topLevel}
            reorder={reorder}
            onRenamed={onRenamed}
            allPages={pages}
            sectionId={sectionId}
            currentPageId={currentPageId}
            onRefresh={onRefresh}
            onNewPage={handleNewPage}
          />
        ))}
      </div>

      <button
        onClick={() => handleNewPage(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 8px',
          margin: '4px 6px 8px',
          borderTop: '1px solid var(--border-faint)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent)',
          background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: 6,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,108,255,.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        NEW PAGE
      </button>

      <style>{`
        .page-node-menu {
          opacity: 0; transition: opacity 0.1s, background 0.1s, color 0.1s;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 22px; height: 22px; margin: -2px 0; padding: 0;
          background: none; border: none; border-radius: 5px; cursor: pointer; color: var(--text-label);
        }
        div:hover > .page-node-menu, .page-node-menu.is-open, .page-node-menu:focus-visible { opacity: 1; }
        .page-node-menu:hover, .page-node-menu.is-open { background: var(--border-faint); color: var(--text); }
        .page-node-menu:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 1px; }
        @media (hover: none) { .page-node-menu { opacity: 1; } }
        .sidebar-collapse {
          display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;
          background: none; border: none; border-radius: 6px; cursor: pointer; color: var(--text-dim);
          transition: background 0.1s, color 0.1s;
        }
        .sidebar-collapse:hover { background: var(--border-faint); color: var(--text); }
        .sidebar-collapse:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 1px; }
        .page-rename-input {
          flex: 1; min-width: 0; margin: -3px 0; padding: 2px 6px;
          font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; color: var(--text);
          background: var(--surface); border: 1px solid var(--accent); border-radius: 5px; outline: none;
        }
      `}</style>

      {newPageTarget && (
        <NewPageModal
          context={newPageTarget.context}
          onConfirm={handleCreate}
          onClose={() => setNewPageTarget(null)}
        />
      )}
    </div>
  );
}
