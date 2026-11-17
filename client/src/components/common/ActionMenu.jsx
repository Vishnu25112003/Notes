import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const icon = d => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const DOTS = [5, 12, 19];
export const DotsIcon = ({ vertical = false }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {DOTS.map(n => <circle key={n} cx={vertical ? 12 : n} cy={vertical ? n : 12} r="1.7" />)}
  </svg>
);
export const PlusIcon = () => icon(<path d="M12 5v14M5 12h14"/>);
export const PencilIcon = () => icon(<><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>);
export const ArrowUp = () => icon(<path d="M12 19V5M6 11l6-6 6 6"/>);
export const ArrowDown = () => icon(<path d="M12 5v14M6 13l6 6 6-6"/>);
export const TrashIcon = () => icon(<><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></>);

const MENU_WIDTH = 188;

const MENU_CSS = `
  .page-menu-item {
    display: flex; align-items: center; gap: 9px; width: 100%;
    padding: 7px 9px; border: none; border-radius: 6px; background: none; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif; font-size: 13px; text-align: left; color: var(--text-mid);
  }
  .page-menu-item:hover:not(:disabled), .page-menu-item:focus-visible { background: var(--border-faint); color: var(--text); outline: none; }
  .page-menu-item:disabled { opacity: 0.35; cursor: default; }
  .page-menu-danger { color: var(--error); }
  .page-menu-danger:hover:not(:disabled), .page-menu-danger:focus-visible { color: var(--error); }
`;

// Floating list of actions anchored to a button. Rendered on <body> and fixed-positioned,
// so no scroll area, clipped card or draggable row can interfere with it.
export default function ActionMenu({ anchor, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = r.bottom + 4;
    setPos({ left, top: below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below });
    ref.current.querySelector('button:not(:disabled)')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onDown = e => {
      if (!ref.current.contains(e.target) && !anchor.contains(e.target)) onClose();
    };
    const onKey = e => {
      if (e.key === 'Escape') { onClose(); anchor.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const buttons = [...ref.current.querySelectorAll('button:not(:disabled)')];
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="page-menu"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', zIndex: 60, width: MENU_WIDTH,
        left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 4,
        boxShadow: '0 14px 32px -10px rgba(0,0,0,.45)',
      }}
    >
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={item.danger ? 'page-menu-item page-menu-danger' : 'page-menu-item'}
          onClick={() => { onClose(); item.onSelect(); }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      <style>{MENU_CSS}</style>
    </div>,
    document.body
  );
}

// Three-dot button that opens an ActionMenu. Stops clicks from reaching a clickable parent card.
export function MenuButton({ label, items, vertical = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${className}${open ? ' is-open' : ''}`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      ><DotsIcon vertical={vertical} /></button>
      {open && <ActionMenu anchor={button.current} items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

// Inline rename field. Enter or blur saves, Escape cancels; a late blur after either is ignored.
export function RenameInput({ initial, onSave, onCancel, className, style, label = 'Name' }) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const finish = save => {
    if (settled.current) return;
    settled.current = true;
    const next = value.trim();
    if (save && next && next !== initial) onSave(next);
    else onCancel();
  };
  return (
    <input
      autoFocus
      className={className}
      style={style}
      aria-label={label}
      value={value}
      onChange={e => setValue(e.target.value)}
      onFocus={e => e.target.select()}
      onClick={e => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={e => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}
