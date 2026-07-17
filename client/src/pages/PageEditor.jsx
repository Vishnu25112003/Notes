import { useState, useEffect, useRef } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { getPage, updatePage } from '../api/pages.js';
import Editor from '../components/editor/Editor.jsx';
import DrawingCanvas from '../components/drawing/DrawingCanvas.jsx';
import Breadcrumbs from '../components/tree/Breadcrumbs.jsx';
import Loader from '../components/common/Loader.jsx';
import SaveStatus from '../components/common/SaveStatus.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';
import ExportModal from '../components/common/ExportModal.jsx';
import ShareModal from '../components/share/ShareModal.jsx';
import { getShareSettings } from '../api/share.js';
import { useAutosave } from '../hooks/useAutosave.js';

const MenuIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M7 10l5 5 5-5M12 15V3"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
  </svg>
);

function getDepth(pages, pageId) {
  let depth = 0;
  let current = pages.find(p => String(p._id) === String(pageId));
  while (current?.parentId) {
    depth++;
    current = pages.find(p => String(p._id) === String(current.parentId));
  }
  return depth;
}

export default function PageEditor() {
  const { pageId } = useParams();
  const { pages, section, onRefresh, setSidebarOpen, isMobile = false } = useOutletContext();
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [drawingId, setDrawingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

  const refreshPending = () => {
    getShareSettings('page', pageId).then(s => setPendingRequests(s.requests.length)).catch(() => {});
  };
  useEffect(() => { refreshPending(); }, [pageId]);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    setLoading(true);
    getPage(pageId).then(p => {
      setPage(p);
      setTitle(p.title);
      setContent(p.content);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pageId]);

  const contentKey = JSON.stringify(content);
  const saveStatus = useAutosave(
    async () => {
      await updatePage(pageId, { title: titleRef.current, content: contentRef.current });
      onRefresh();
    },
    [title, contentKey]
  );

  if (loading) return <Loader />;
  if (!page) return <div style={{ padding: 32, color: 'var(--text-label)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>Page not found</div>;

  const depth = getDepth(pages, pageId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        .page-editor-content { padding: 30px 44px 0; }
        .page-editor-title { font-size: 30px; }
        @media (max-width: 767px) {
          .page-editor-content { padding: 20px 16px 0; }
          .page-editor-title { font-size: 24px; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border-faint)', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '2px 4px' }}
              title="Open page list"
            ><MenuIcon /></button>
          )}
          <Breadcrumbs section={section} pages={pages} currentPageId={pageId} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setSharing(true)}
            title="Share this page"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.07em', color: 'var(--text-mid)', background: 'var(--card-subtle)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
          >
            <ShareIcon /> SHARE
            {pendingRequests > 0 && (
              <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 16, height: 16, borderRadius: 9, background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {pendingRequests}
              </span>
            )}
          </button>
          <button
            onClick={() => setExporting(true)}
            title="Export"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.07em', color: 'var(--text-mid)', background: 'var(--card-subtle)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
          >
            <ExportIcon /> EXPORT
          </button>
          <ThemeToggle />
          <SaveStatus status={saveStatus} />
        </div>
      </div>

      {/* Editor content */}
      <div className="page-editor-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-label)', marginBottom: 9 }}>
          PAGE · DEPTH {depth}
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Page title"
          className="page-editor-title"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            display: 'block',
            marginBottom: 4,
          }}
        />
        <Editor
          key={pageId}
          content={content}
          onChange={setContent}
          pageId={pageId}
          onOpenDrawing={setDrawingId}
          placeholder="Start writing…"
        />
      </div>

      {drawingId && (
        <DrawingCanvas
          drawingId={drawingId}
          onClose={() => setDrawingId(null)}
          onSaved={() => {}}
        />
      )}

      {exporting && (
        <ExportModal title={title} content={content} onClose={() => setExporting(false)} />
      )}

      {sharing && (
        <ShareModal type="page" id={pageId} onClose={() => { setSharing(false); refreshPending(); }} />
      )}
    </div>
  );
}
