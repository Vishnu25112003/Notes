import { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Loader from '../common/Loader.jsx';
import {
  getShareSettings,
  updateShareSettings,
  addShareUser,
  removeShareUser,
  approveRequest,
  denyRequest,
} from '../../api/share.js';

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Space Grotesk', sans-serif";

const label = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-label)', marginBottom: 7 };

const VIA_LABELS = { granted: 'ADDED', approved: 'APPROVED', public: 'VIA LINK' };

function Segmented({ value, options, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => !disabled && !active && onChange(opt.value)}
            style={{
              flex: 1,
              padding: '9px 10px',
              border: 'none',
              cursor: disabled ? 'wait' : 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-fg)' : 'var(--text-dim)',
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '0.08em',
              fontWeight: 600,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ShareModal({ type, id, onClose, noun = 'note' }) {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [userError, setUserError] = useState(null);

  useEffect(() => {
    getShareSettings(type, id).then(setSettings).catch(() => setSettings(null));
  }, [type, id]);

  const shareLink = `${window.location.origin}/shared/${type}/${id}`;

  const mutate = async (fn) => {
    setBusy(true);
    try {
      setSettings(await fn());
    } finally {
      setBusy(false);
    }
  };

  const changeSetting = (patch) =>
    mutate(() => updateShareSettings(type, id, patch)).catch(() => {});

  const handleAddUser = async () => {
    const username = newUser.trim();
    if (!username) return;
    setUserError(null);
    try {
      await mutate(() => addShareUser(type, id, username));
      setNewUser('');
    } catch (err) {
      setUserError(typeof err === 'string' ? err : 'Could not add user');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Modal title="Share" onClose={onClose}>
      {!settings ? (
        <Loader />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>

          {/* Share link */}
          <div>
            <div style={label}>SHARE LINK</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                readOnly
                value={shareLink}
                onFocus={e => e.target.select()}
                style={{ flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontFamily: MONO, fontSize: 11, color: 'var(--text-mid)', outline: 'none' }}
              />
              <button
                onClick={handleCopy}
                style={{ padding: '9px 14px', borderRadius: 7, border: 'none', background: copied ? 'var(--success, #5be3a0)' : 'var(--accent)', color: copied ? '#0b0d16' : 'var(--accent-fg)', cursor: 'pointer', fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0 }}
              >{copied ? 'COPIED' : 'COPY'}</button>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <div style={label}>VISIBILITY</div>
            <Segmented
              value={settings.visibility}
              disabled={busy}
              options={[{ value: 'private', label: 'PRIVATE' }, { value: 'public', label: 'PUBLIC' }]}
              onChange={v => changeSetting({ visibility: v })}
            />
            <div style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
              {settings.visibility === 'public'
                ? `Anyone with the link who is signed in can access this ${noun}.`
                : `Only people you add or approve below can access this ${noun}.`}
            </div>
          </div>

          {/* Permission */}
          <div>
            <div style={label}>PERMISSION</div>
            <Segmented
              value={settings.permission}
              disabled={busy}
              options={[{ value: 'view', label: 'VIEW' }, { value: 'edit', label: 'EDIT' }]}
              onChange={v => changeSetting({ permission: v })}
            />
            <div style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
              {settings.permission === 'edit'
                ? `People with access can edit this ${noun}${noun === 'section' ? "'s pages" : ''}.`
                : `People with access can only view this ${noun}.`}
            </div>
          </div>

          {/* Allow clone */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ ...label, marginBottom: 3 }}>ALLOW CLONE</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                Let receivers copy this {noun} into their own account.
              </div>
            </div>
            <button
              onClick={() => !busy && changeSetting({ allowClone: !settings.allowClone })}
              title={settings.allowClone ? 'Disable cloning' : 'Enable cloning'}
              style={{
                width: 42, height: 24, borderRadius: 13, border: '1px solid var(--border)',
                background: settings.allowClone ? 'var(--accent)' : 'var(--border-faint)',
                position: 'relative', cursor: busy ? 'wait' : 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: settings.allowClone ? 20 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s', display: 'block',
              }} />
            </button>
          </div>

          {/* People with access */}
          <div>
            <div style={label}>PEOPLE WITH ACCESS</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newUser}
                onChange={e => { setNewUser(e.target.value); setUserError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                placeholder="Add by username"
                style={{ flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontFamily: SANS, fontSize: 13, color: 'var(--text-2)', outline: 'none' }}
              />
              <button
                onClick={handleAddUser}
                disabled={busy || !newUser.trim()}
                style={{ padding: '9px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-subtle)', color: 'var(--accent)', cursor: 'pointer', fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', fontWeight: 600, opacity: !newUser.trim() ? 0.5 : 1, flexShrink: 0 }}
              >ADD</button>
            </div>
            {userError && (
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: 'var(--error)', marginTop: 6 }}>✕ {userError.toUpperCase()}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {settings.sharedWith.length === 0 && (
                <div style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-label)', fontStyle: 'italic' }}>No one has been added yet.</div>
              )}
              {settings.sharedWith.map(u => (
                <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-faint)', borderRadius: 7, padding: '7px 10px', background: 'var(--card-subtle)' }}>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.username}</span>
                  <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.08em', color: u.via === 'public' ? 'var(--text-label)' : 'var(--accent)', border: `1px solid ${u.via === 'public' ? 'var(--border)' : 'rgba(124,108,255,.4)'}`, borderRadius: 10, padding: '2px 7px', flexShrink: 0 }}>
                    {VIA_LABELS[u.via] || u.via.toUpperCase()}
                  </span>
                  <button
                    onClick={() => mutate(() => removeShareUser(type, id, u.userId)).catch(() => {})}
                    title="Remove access"
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Pending requests */}
          {settings.requests.length > 0 && (
            <div>
              <div style={label}>PENDING REQUESTS ({settings.requests.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {settings.requests.map(r => (
                  <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(124,108,255,.35)', borderRadius: 7, padding: '7px 10px', background: 'rgba(124,108,255,.06)' }}>
                    <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{r.username}</span>
                    <button
                      onClick={() => mutate(() => approveRequest(type, id, r.userId)).catch(() => {})}
                      style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: 'pointer', fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0 }}
                    >APPROVE</button>
                    <button
                      onClick={() => mutate(() => denyRequest(type, id, r.userId)).catch(() => {})}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--error-border, var(--border))', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0 }}
                    >DENY</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
