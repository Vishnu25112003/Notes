import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { ImageBlock } from './ImageBlock.js';
import { DrawingBlock } from './DrawingBlock.js';
import EditorToolbar from './EditorToolbar.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { deleteDrawing } from '../../api/drawings.js';

export default function Editor({ content, onChange, pageId, onOpenDrawing, placeholder = 'Start writing…' }) {
  const openDrawingRef = useRef(onOpenDrawing);
  openDrawingRef.current = onOpenDrawing;
  const [pendingDelete, setPendingDelete] = useState(null);

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
    const openHandler = (e) => {
      if (openDrawingRef.current) openDrawingRef.current(e.detail.drawingId);
    };
    const deleteHandler = (e) => {
      setPendingDelete(e.detail.drawingId);
    };
    const el = editor.view.dom;
    el.addEventListener('open-drawing', openHandler);
    el.addEventListener('delete-drawing', deleteHandler);
    return () => {
      el.removeEventListener('open-drawing', openHandler);
      el.removeEventListener('delete-drawing', deleteHandler);
    };
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

  const handleConfirmDelete = async () => {
    const drawingId = pendingDelete;
    setPendingDelete(null);
    if (!editor || !drawingId) return;
    const { state, view } = editor;
    const tr = state.tr;
    const targets = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'drawingBlock' && node.attrs.drawingId === drawingId) {
        targets.push({ pos, size: node.nodeSize });
      }
    });
    targets.reverse().forEach(({ pos, size }) => tr.delete(pos, pos + size));
    if (targets.length) view.dispatch(tr);
    try {
      await deleteDrawing(drawingId);
    } catch {
      // note content is already updated; the orphaned record is harmless
    }
  };

  return (
    <div
      className="flex flex-col flex-1 rounded-xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <EditorToolbar editor={editor} pageId={pageId} onOpenDrawing={onOpenDrawing} />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete drawing?"
          message="This will remove the drawing from this note and delete it permanently. This cannot be undone."
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
