import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveShared, saveShared, requestAccess, cloneShared } from '../api/share.js';
import Editor from '../components/editor/Editor.jsx';
import Loader from '../components/common/Loader.jsx';
import SaveStatus from '../components/common/SaveStatus.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';
import { useAutosave } from '../hooks/useAutosave.js';

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Space Grotesk', sans-serif";

const BackArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const CloneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const LockIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

function CenterCard({ icon, title, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 12, padding: '36px 28px', background: 'var(--card-subtle)' }}>
        {icon && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>{icon}</div>}
        <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function SharedViewer() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [requestState, setRequestState] = useState(null); // null | 'sending' | 'pending'
  const [cloning, setCloning] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  const load = () => {
    resolveShared(type, id)
      .then(res => {
        if (res.status === 'owner') {
          const { native } = res;
          const target = native.type === 'note'
            ? `/simple/${native.id}`
            : native.type === 'section'
              ? `/sections/${native.id}`
              : `/sections/${native.sectionId}/pages/${native.id}`;
          navigate(target, { replace: true });
          return;
        }
        if (res.status === 'denied') {
          setState({ status: 'denied' });
          setRequestState(res.requestPending ? 'pending' : null);
          return;
        }
        if (res.kind === 'section') {
          setState({
            status: 'ok',
            kind: 'section',
            owner: res.owner,
            permission: res.permission,
            allowClone: res.allowClone,
            section: res.section,
            pages: res.pages,
          });
          return;
        }
        setTitle(res.note.title);
        setContent(res.note.content);
        setState({ status: 'ok', kind: 'doc', owner: res.owner, permission: res.permission, allowClone: res.allowClone });
      })
      .catch(() => setState({ status: 'gone' }));
  };

  useEffect(() => {
    if (type !== 'note' && type !== 'page' && type !== 'section') {
      navigate('/shared', { replace: true });
      return;
    }
    setState({ status: 'loading' });
    setRevoked(false);
    load();
  }, [type, id]);

  const editable = state.status === 'ok' && state.permission === 'edit';

  const contentKey = JSON.stringify(content);
  const saveStatus = useAutosave(
    async () => {
      if (!editable) return;
      try {
        await saveShared(type, id, { title: titleRef.current, content: contentRef.current });
      } catch (err) {
        // Access may have been revoked mid-session — re-check before surfacing the error
        try {
          const res = await resolveShared(type, id);
          if (res.status === 'denied') {
            setRevoked(true);
            setState({ status: 'denied' });
            setRequestState(res.requestPending ? 'pending' : null);
          }
        } catch { /* note deleted */ setState({ status: 'gone' }); }
        throw err;
      }
    },
    [title, contentKey]
  );

  const handleRequest = async () => {
    setRequestState('sending');
    try {
      const res = await requestAccess(type, id);
      if (res.status === 'already-has-access') { load(); return; }
      setRequestState('pending');
    } catch {
      setRequestState(null);
    }
  };

  const handleClone = async () => {
    if (cloning) return;
    setCloning(true);
    try {
      const res = await cloneShared(type, id);
      navigate(type === 'section' ? `/sections/${res.id}` : `/simple/${res.id}`);
    } catch {
      setCloning(false);
    }
  };

  if (state.status === 'loading') return <Loader fullScreen />;

  if (state.status === 'gone') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />
        <CenterCard title="This note is no longer available">
          <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5 }}>
            It may have been deleted by its owner.
          </div>
          <button
            onClick={() => navigate('/shared')}
            style={{ padding: '10px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
          >BACK TO SHARED</button>
        </CenterCard>
      </div>
    );
  }

  if (state.status === 'denied') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border-faint)' }}>
          <button
            onClick={() => navigate('/shared')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <BackArrow /> SHARED
          </button>
        </div>
        <CenterCard icon={<LockIcon />} title="You need access">
          {revoked && (
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: 'var(--error)', marginBottom: 12 }}>
              YOUR ACCESS WAS CHANGED BY THE OWNER
            </div>
          )}
          <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5 }}>
            This note is private. Ask the owner for access — once they approve, you can open it here.
          </div>
          {requestState === 'pending' ? (
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent)' }}>
              ✓ REQUEST SENT — WAITING FOR OWNER APPROVAL
            </div>
          ) : (
            <button
              onClick={handleRequest}
              disabled={requestState === 'sending'}
              style={{ padding: '10px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: requestState === 'sending' ? 'wait' : 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}
            >{requestState === 'sending' ? 'SENDING…' : 'REQUEST ACCESS'}</button>
          )}
        </CenterCard>
      </div>
    );
  }

  // ---- Section view: browse the shared section's pages ----
  if (state.kind === 'section') {
    // Flatten the page tree into a depth-ordered list for display
    const byParent = new Map();
    for (const p of state.pages) {
      const key = p.parentId ? String(p.parentId) : 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(p);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);
    const ordered = [];
    const walk = (key, depth) => {
      for (const p of byParent.get(key) || []) {
        ordered.push({ ...p, depth });
        walk(String(p.id), depth + 1);
      }
    };
    walk('root', 0);

    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border-faint)', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button
              onClick={() => navigate('/shared')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              <BackArrow /> SHARED
            </button>
            <span style={{ width: 1, height: 18, background: 'var(--divider)', flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--text-label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              SHARED BY @{state.owner?.toUpperCase()}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: editable ? '#5be3a0' : 'var(--accent)', border: `1px solid ${editable ? 'rgba(91,227,160,.4)' : 'rgba(124,108,255,.4)'}`, borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>
              {editable ? 'CAN EDIT' : 'VIEW ONLY'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={state.allowClone ? handleClone : undefined}
              disabled={!state.allowClone || cloning}
              title={state.allowClone ? 'Copy this section into your account' : 'Owner disabled cloning'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.07em', fontWeight: 600,
                color: 'var(--accent-fg)', background: 'var(--accent)',
                border: 'none', borderRadius: 7, padding: '7px 12px',
                cursor: state.allowClone ? (cloning ? 'wait' : 'pointer') : 'not-allowed',
                opacity: state.allowClone ? 1 : 0.45,
              }}
            >
              <CloneIcon /> {cloning ? 'CLONING…' : 'CLONE'}
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Section header + page list */}
        <div style={{ flex: 1, overflowY: 'auto', maxWidth: 780, width: '100%', margin: '0 auto', padding: '34px 24px 40px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-label)', marginBottom: 10 }}>
            SHARED · SECTION
          </div>
          <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 6 }}>
            {state.section.title}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 22 }}>
            {ordered.length} PAGE{ordered.length === 1 ? '' : 'S'}
          </div>

          {ordered.length === 0 ? (
            <div style={{ fontFamily: SANS, fontSize: 14, color: 'var(--text-label)', fontStyle: 'italic' }}>
              This section has no pages yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ordered.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/shared/page/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left', width: '100%',
                    marginLeft: p.depth * 18, maxWidth: `calc(100% - ${p.depth * 18}px)`,
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '11px 14px', background: 'var(--card-subtle)', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,108,255,.5)'; e.currentTarget.style.background = 'rgba(124,108,255,.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-subtle)'; }}
                >
                  <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>
                    </svg>
                  </span>
                  <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Untitled Page'}
                  </span>
                  <span style={{ color: 'var(--text-label)', display: 'flex', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)' }} />

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border-faint)', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate('/shared')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <BackArrow /> SHARED
          </button>
          <span style={{ width: 1, height: 18, background: 'var(--divider)', flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--text-label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            SHARED BY @{state.owner?.toUpperCase()}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: editable ? '#5be3a0' : 'var(--accent)', border: `1px solid ${editable ? 'rgba(91,227,160,.4)' : 'rgba(124,108,255,.4)'}`, borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>
            {editable ? 'CAN EDIT' : 'VIEW ONLY'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={state.allowClone ? handleClone : undefined}
            disabled={!state.allowClone || cloning}
            title={state.allowClone ? 'Copy this note into your account' : 'Owner disabled cloning'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.07em', fontWeight: 600,
              color: 'var(--accent-fg)', background: 'var(--accent)',
              border: 'none', borderRadius: 7, padding: '7px 12px',
              cursor: state.allowClone ? (cloning ? 'wait' : 'pointer') : 'not-allowed',
              opacity: state.allowClone ? 1 : 0.45,
            }}
          >
            <CloneIcon /> {cloning ? 'CLONING…' : 'CLONE'}
          </button>
          <ThemeToggle />
          {editable && <SaveStatus status={saveStatus} />}
        </div>
      </div>

      <style>{`
        .shared-editor-area { padding: 34px 56px 0; }
        .shared-editor-title { font-size: 34px; }
        @media (max-width: 767px) {
          .shared-editor-area { padding: 20px 16px 0; }
          .shared-editor-title { font-size: 26px; }
        }
      `}</style>

      {/* Editor area */}
      <div className="shared-editor-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 780, width: '100%', margin: '0 auto' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-label)', marginBottom: 10 }}>
          SHARED · {type.toUpperCase()}
        </div>
        <input
          value={title}
          onChange={e => editable && setTitle(e.target.value)}
          readOnly={!editable}
          placeholder="Title"
          className="shared-editor-title"
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            marginBottom: 8,
            cursor: editable ? 'text' : 'default',
          }}
        />
        <Editor
          key={`${type}-${id}-${editable}`}
          content={content}
          onChange={setContent}
          editable={editable}
          allowDrawings={false}
          placeholder={editable ? 'Start writing…' : 'Empty note'}
        />
      </div>
    </div>
  );
}
