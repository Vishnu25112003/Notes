import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Accessible modal: labelled, Escape closes, focus moves in and returns to the opener, Tab stays inside.
export default function Dialog({ title, children, onClose, wide = false, footer, describedBy }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const el = ref.current;
    const focusable = () => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled);
    (el.querySelector('[data-autofocus]') || focusable()[1] || focusable()[0])?.focus();
    // Escape is handled at document level so it still works after the focused button disappears,
    // but only by the top-most dialog when two are stacked
    const onEscape = (e) => {
      if (e.key !== 'Escape' || !closeRef.current) return;
      const all = document.querySelectorAll('.v-dialog');
      if (all[all.length - 1] !== el) return;
      e.stopPropagation();
      closeRef.current();
    };
    const onKey = (e) => {
      if (e.key === 'Tab') {
        const f = focusable();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    el.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onEscape);
    return () => { el.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onEscape); opener?.focus?.(); };
  }, []);

  return (
    <div className="v-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} className={`v-dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="v-dialog-title" aria-describedby={describedBy}>
        <div className="v-dialog-head">
          <h2 id="v-dialog-title" className="v-h2" style={{ margin: 0 }}>{title}</h2>
          {onClose && (
            <button type="button" className="v-btn icon ghost" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="v-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
