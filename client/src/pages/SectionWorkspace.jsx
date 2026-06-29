import { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { getSectionPages, getSections } from '../api/sections.js';
import PageTreeSidebar from '../components/tree/PageTreeSidebar.jsx';
import SearchBar from '../components/common/SearchBar.jsx';
import Loader from '../components/common/Loader.jsx';
import { createPage } from '../api/pages.js';

const GRID_BG = {
  backgroundColor: '#0a0a0c',
  backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)',
  backgroundSize: '32px 32px',
};

const MenuIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
);

const DocIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
  </svg>
);

export default function SectionWorkspace() {
  const { sectionId, pageId } = useParams();
  const [pages, setPages] = useState([]);
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [pagesData, sectionsData] = await Promise.all([
        getSectionPages(sectionId),
        getSections(),
      ]);
      setPages(pagesData);
      setSection(sectionsData.find(s => String(s._id) === sectionId) || null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sectionId]);

  const handleAddFirstPage = async () => {
    const page = await createPage({ sectionId, parentId: null, title: 'Untitled Page' });
    load();
    navigate(`/sections/${sectionId}/pages/${page._id}`);
  };

  if (loading) return <Loader fullScreen />;

  const showSidebar = sidebarOpen || !!pageId;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0c' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#7c6cff,#4b3fd6 55%,transparent)', flexShrink: 0 }} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        {showSidebar && (
          <div style={{
            width: pageId ? 230 : 280,
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.2s',
          }}>
            <PageTreeSidebar
              pages={pages}
              sectionId={sectionId}
              currentPageId={pageId}
              onRefresh={load}
            />
          </div>
        )}

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {pageId ? (
            <Outlet context={{ pages, section, onRefresh: load, sidebarOpen, setSidebarOpen }} />
          ) : (
            <>
              {/* Workspace header (only shown when no page is open) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button
                    onClick={() => setSidebarOpen(o => !o)}
                    style={{ color: '#7a7a85', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  ><MenuIcon /></button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#7a7a85' }}>
                    <button onClick={() => navigate('/sections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a7a85', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}>SECTIONS</button>
                    <span style={{ color: '#3a3a42' }}>/</span>
                    <span style={{ color: '#f4f4f6', fontWeight: 600 }}>{section?.title}</span>
                  </span>
                </div>
                <SearchBar />
              </div>

              {/* Select page / empty state */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...GRID_BG, gap: 14 }}>
                {pages.length === 0 ? (
                  <>
                    <div style={{
                      position: 'relative', width: 70, height: 70,
                      border: '1px solid #2a2a31', borderRadius: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(124,108,255,.06)',
                    }}>
                      <span style={{ color: '#7c6cff' }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
                          <path d="M14 3v5h5"/>
                        </svg>
                      </span>
                      <button
                        onClick={handleAddFirstPage}
                        style={{
                          position: 'absolute', bottom: -6, right: -6,
                          width: 24, height: 24, borderRadius: '50%',
                          background: '#7c6cff', color: '#0a0a0c',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                        }}
                      >+</button>
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: '#ededf0' }}>No pages yet</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.04em', color: '#7a7a85' }}>PRESS + TO CREATE YOUR FIRST PAGE</div>
                    <button
                      onClick={handleAddFirstPage}
                      style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#0a0a0c', background: '#7c6cff', border: 'none', borderRadius: 7, padding: '9px 16px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                      NEW PAGE
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#34343c' }}><DocIcon /></span>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: '#9a9aa5' }}>Select a page</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#55555f', letterSpacing: '0.06em' }}>OR PRESS ⌘K TO SEARCH</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
