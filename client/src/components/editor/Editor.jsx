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
      attributes: { class: 'tiptap prose-invert min-h-[200px] px-1 py-2 focus:outline-none' },
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

  return (
    <div className="flex flex-col flex-1 border border-white/10 rounded-xl overflow-hidden bg-[#161616]">
      <EditorToolbar editor={editor} pageId={pageId} onOpenDrawing={onOpenDrawing} />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
