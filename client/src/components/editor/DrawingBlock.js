import { Node, mergeAttributes } from '@tiptap/core';

const EDIT_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
const TRASH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>`;

export const DrawingBlock = Node.create({
  name: 'drawingBlock',
  group: 'block',
  atom: true,
  addOptions() {
    return { interactive: true };
  },
  addAttributes() {
    return {
      drawingId: { default: null },
      exportUrl: { default: null },
      width: {
        default: '100%',
        parseHTML: el => el.getAttribute('data-width') || '100%',
        renderHTML: attrs => ({ 'data-width': attrs.width }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="drawingBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'drawingBlock' })];
  },
  addNodeView() {
    const { interactive } = this.options;
    return ({ node, editor, getPos }) => {
      let currentNode = node;

      const dom = document.createElement('div');
      dom.className = 'drawing-block-wrapper';
      dom.contentEditable = 'false';
      dom.style.cssText = 'position:relative;border:1px solid var(--border);border-radius:8px;margin:0.5rem 0;max-width:100%;min-width:120px;';
      dom.style.width = currentNode.attrs.width || '100%';

      // Content area (image or placeholder) — clicking it opens the drawing
      const content = document.createElement('div');
      content.style.cssText = 'cursor:pointer;overflow:hidden;border-radius:7px;';
      dom.appendChild(content);

      const renderContent = () => {
        content.innerHTML = '';
        if (currentNode.attrs.exportUrl) {
          const img = document.createElement('img');
          img.src = currentNode.attrs.exportUrl;
          img.draggable = false;
          img.style.cssText = 'width:100%;display:block;';
          content.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'padding:2rem;text-align:center;color:var(--text-dim);background:var(--surface);';
          placeholder.textContent = interactive ? '✏️ Drawing (click to edit)' : '✏️ Drawing';
          content.appendChild(placeholder);
        }
      };
      renderContent();

      const openDrawing = () => {
        dom.dispatchEvent(new CustomEvent('open-drawing', { detail: { drawingId: currentNode.attrs.drawingId }, bubbles: true }));
      };
      if (interactive) {
        content.addEventListener('click', openDrawing);
      } else {
        content.style.cursor = 'default';
      }

      // Floating controls + resize handle only for interactive editors
      if (interactive) {
        const controls = document.createElement('div');
        controls.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:4px;z-index:2;';
        const makeBtn = (icon, title, danger) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.title = title;
          b.innerHTML = icon;
          b.style.cssText = `display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:${danger ? 'var(--error)' : 'var(--text-mid)'};cursor:pointer;opacity:0.9;`;
          return b;
        };
        const editBtn = makeBtn(EDIT_ICON, 'Edit drawing', false);
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); openDrawing(); });
        const deleteBtn = makeBtn(TRASH_ICON, 'Delete drawing', true);
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dom.dispatchEvent(new CustomEvent('delete-drawing', { detail: { drawingId: currentNode.attrs.drawingId }, bubbles: true }));
        });
        controls.appendChild(editBtn);
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
      }

      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'drawingBlock') return false;
          const prev = currentNode;
          currentNode = updated;
          dom.style.width = updated.attrs.width || '100%';
          if (updated.attrs.exportUrl !== prev.attrs.exportUrl) renderContent();
          return true;
        },
        ignoreMutation: () => true,
      };
    };
  },
});
