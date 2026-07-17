import { Node, mergeAttributes } from '@tiptap/core';

const TRASH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>`;

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: {
        default: '100%',
        parseHTML: el => el.getAttribute('data-width') || '100%',
        renderHTML: attrs => ({ 'data-width': attrs.width, style: `width:${attrs.width};max-width:100%;` }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-type="imageBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-type': 'imageBlock' })];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;

      const dom = document.createElement('div');
      dom.className = 'image-block-wrapper';
      dom.contentEditable = 'false';
      dom.style.cssText = 'position:relative;margin:0.5rem 0;max-width:100%;min-width:120px;';
      dom.style.width = currentNode.attrs.width || '100%';

      const img = document.createElement('img');
      img.src = currentNode.attrs.src;
      img.alt = currentNode.attrs.alt;
      img.draggable = false;
      img.style.cssText = 'width:100%;border-radius:6px;display:block;';
      dom.appendChild(img);

      // Floating delete control (top-right)
      const controls = document.createElement('div');
      controls.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:4px;z-index:2;';
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.title = 'Remove image';
      deleteBtn.innerHTML = TRASH_ICON;
      deleteBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--error);cursor:pointer;opacity:0.9;';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.dispatchEvent(new CustomEvent('delete-image', { detail: { getPos }, bubbles: true }));
      });
      controls.appendChild(deleteBtn);
      dom.appendChild(controls);

      // Resize handle (bottom-right) — pointer events work for both mouse and touch
      const handle = document.createElement('div');
      handle.title = 'Drag to resize';
      handle.style.cssText = 'position:absolute;bottom:2px;right:2px;width:22px;height:22px;display:flex;align-items:flex-end;justify-content:flex-end;cursor:nwse-resize;touch-action:none;z-index:2;padding:0 3px 3px 0;';
      handle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v6h-6"/><path d="M21 11l-10 10"/></svg>`;
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startWidth = dom.getBoundingClientRect().width;
        const parentWidth = dom.parentElement ? dom.parentElement.getBoundingClientRect().width : startWidth;
        const onMove = (ev) => {
          const pct = Math.min(100, Math.max(20, ((startWidth + ev.clientX - startX) / parentWidth) * 100));
          dom.style.width = pct.toFixed(1) + '%';
        };
        const onUp = () => {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          const width = dom.style.width;
          if (typeof getPos === 'function' && width && width !== currentNode.attrs.width) {
            const pos = getPos();
            if (typeof pos === 'number') {
              const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, width });
              editor.view.dispatch(tr);
            }
          }
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });
      dom.appendChild(handle);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'imageBlock') return false;
          currentNode = updated;
          dom.style.width = updated.attrs.width || '100%';
          if (img.src !== updated.attrs.src) img.src = updated.attrs.src;
          return true;
        },
        ignoreMutation: () => true,
      };
    };
  },
});
