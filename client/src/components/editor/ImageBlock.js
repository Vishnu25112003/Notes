import { Node, mergeAttributes } from '@tiptap/core';

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-type="imageBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-type': 'imageBlock' })];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'my-2';
      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.alt;
      img.style.cssText = 'max-width:100%;border-radius:6px;display:block;';
      dom.appendChild(img);
      return { dom };
    };
  },
});
