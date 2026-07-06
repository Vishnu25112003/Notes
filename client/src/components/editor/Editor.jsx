import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { ImageBlock } from './ImageBlock.js';
import { DrawingBlock } from './DrawingBlock.js';
import EditorToolbar from './EditorToolbar.jsx';

export default function Editor({ content, onChange, pageId, onOpenDrawing, placeholder = 'Start writing…' }) {
  const openDrawingRef = useRef(onOpenDrawing);
  openDrawingRef.current = onOpenDrawing;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
      ImageBlock,
      DrawingBlock,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange && onChange(editor.getJSON());
    },
    editorProps: {
      attributes: { class: 'tiptap min-h-[200px] px-1 py-2 focus:outline-none' },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const handler = (e) => {
      if (openDrawingRef.current) openDrawingRef.current(e.detail.drawingId);
    };
    const el = editor.view.dom;
    el.addEventListener('open-drawing', handler);
    return () => el.removeEventListener('open-drawing', handler);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const handler = (e) => {
      const { drawingId, exportUrl } = e.detail;
      const { state, view } = editor;
      const tr = state.tr;
      let changed = false;
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'drawingBlock' && node.attrs.drawingId === drawingId) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, exportUrl });
          changed = true;
        }
      });
      if (changed) view.dispatch(tr);
    };
    window.addEventListener('drawing-saved', handler);
    return () => window.removeEventListener('drawing-saved', handler);
  }, [editor]);

  return (
    <div
      className="flex flex-col flex-1 rounded-xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <EditorToolbar editor={editor} pageId={pageId} onOpenDrawing={onOpenDrawing} />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
