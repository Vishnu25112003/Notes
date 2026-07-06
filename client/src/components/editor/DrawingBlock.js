import { Node, mergeAttributes } from '@tiptap/core';

export const DrawingBlock = Node.create({
  name: 'drawingBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      drawingId: { default: null },
      exportUrl: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="drawingBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'drawingBlock' })];
  },
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'drawing-block-wrapper';
      dom.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;margin:0.5rem 0;cursor:pointer;';

      if (node.attrs.exportUrl) {
        const img = document.createElement('img');
        img.src = node.attrs.exportUrl;
        img.style.cssText = 'width:100%;display:block;';
        dom.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'padding:2rem;text-align:center;color:var(--text-dim);background:var(--surface);';
        placeholder.textContent = '✏️ Drawing (click to edit)';
        dom.appendChild(placeholder);
      }

      dom.addEventListener('click', () => {
        const event = new CustomEvent('open-drawing', { detail: { drawingId: node.attrs.drawingId }, bubbles: true });
        dom.dispatchEvent(event);
      });

      return { dom };
    };
  },
});
