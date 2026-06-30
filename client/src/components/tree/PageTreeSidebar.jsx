import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPage, deletePage } from '../../api/pages.js';
import ConfirmDialog from '../common/ConfirmDialog.jsx';

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
          background: '#121216', border: '1px solid #2a2a31',
          borderRadius: 12, padding: 22,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <span style={{ color: '#7c6cff' }}><DocIcon /></span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: '#f4f4f6' }}>New Page</span>
          {context && (
            <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#55555f' }}>
              IN {context.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: '#55555f', marginBottom: 7 }}>PAGE TITLE</div>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && title.trim() && onConfirm(title)}
          placeholder="Untitled"
          style={{
            width: '100%', background: '#0a0a0c',
            border: '1px solid #7c6cff', borderRadius: 8,
            padding: '11px 13px',
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: '#ededf0',
            outline: 'none', display: 'block',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', borderRadius: 7, border: '1px solid #2e2e36', background: 'transparent', color: '#c8c8d0', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
          >CANCEL</button>
          <button
            onClick={() => title.trim() && onConfirm(title)}
            style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: '#7c6cff', color: '#0a0a0c', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
          >CREATE</button>
        </div>
      </div>
    </div>
  );
}

function PageNode({ page, allPages, sectionId, currentPageId, depth = 0, onRefresh, onNewPage }) {
  const [open, setOpen] = useState(depth < 2);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();

  const children = allPages.filter(p => String(p.parentId) === String(page._id));
  const isActive = String(page._id) === String(currentPageId);

  const handleDelete = async () => {
    await deletePage(page._id);
    onRefresh();
    navigate(`/sections/${sectionId}`);
  };

  const indent = 8 + depth * 20;

  return (
    <div>
      <div
        style={{
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
          color: isActive ? '#cfc8ff' : '#9a9aa5',
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.color = '#c8c8d0'; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9a9aa5'; } }}
        onClick={() => navigate(`/sections/${sectionId}/pages/${page._id}`)}
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
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isActive ? <strong>{page.title}</strong> : page.title}
        </span>
        <span
          onClick={e => { e.stopPropagation(); onNewPage(page._id, page.title); }}
          style={{ fontSize: 14, color: '#55555f', cursor: 'pointer', padding: '0 2px', opacity: 0 }}
          className="page-node-action"
          title="Add sub-page"
        >+</span>
        <span
          onClick={e => { e.stopPropagation(); setConfirm(true); }}
          style={{ fontSize: 14, color: '#55555f', cursor: 'pointer', padding: '0 2px', opacity: 0 }}
          className="page-node-action"
          title="Delete"
          onMouseEnter={e => e.currentTarget.style.color = '#ec5d8a'}
          onMouseLeave={e => e.currentTarget.style.color = '#55555f'}
        >×</span>
      </div>

      {open && children.length > 0 && (
        <div>
          {children.sort((a, b) => a.order - b.order).map(child => (
            <PageNode
              key={child._id}
              page={child}
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

export default function PageTreeSidebar({ pages, sectionId, currentPageId, onRefresh }) {
  const navigate = useNavigate();
  const [newPageTarget, setNewPageTarget] = useState(null); // {parentId, context}
  const topLevel = pages.filter(p => !p.parentId).sort((a, b) => a.order - b.order);

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
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#55555f', padding: '14px 8px 10px 16px' }}>PAGES</div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
        {topLevel.map(page => (
          <PageNode
            key={page._id}
            page={page}
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
          borderTop: '1px solid rgba(255,255,255,.06)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#7c6cff',
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
        .page-node-action { transition: opacity 0.1s; }
        div:hover > .page-node-action { opacity: 1 !important; }
        @media (hover: none) { .page-node-action { opacity: 1 !important; } }
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
