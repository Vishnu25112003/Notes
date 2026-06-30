import { useRef } from 'react';
import { uploadImage } from '../../api/upload.js';
import { createDrawing } from '../../api/drawings.js';

const Divider = () => (
  <span style={{ width: 1, height: 18, background: 'var(--divider)', margin: '0 6px', display: 'inline-block' }} />
);

export default function EditorToolbar({ editor, pageId, onOpenDrawing }) {
  const fileRef = useRef(null);

  if (!editor) return null;

  const btn = (active, onClick, children) => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 9px',
        borderRadius: 5,
        border: 'none',
        background: active ? 'rgba(124,108,255,.16)' : 'transparent',
        color: active ? 'var(--text-mid)' : 'var(--text-dim)',
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        transition: 'color 0.1s, background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-mid)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)'; }}
    >
      {children}
    </button>
  );

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().insertContent({ type: 'imageBlock', attrs: { src: url, alt: file.name } }).run();
    } catch { alert('Image upload failed'); }
    e.target.value = '';
  };

  const handleInsertDrawing = async () => {
    try {
      const drawing = await createDrawing({ pageId: pageId || null, sceneData: {} });
      editor.chain().focus().insertContent({ type: 'drawingBlock', attrs: { drawingId: drawing._id, exportUrl: null } }).run();
      if (onOpenDrawing) onOpenDrawing(drawing._id);
    } catch { alert('Could not create drawing'); }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 2,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 9,
      padding: '7px 10px',
      margin: '20px 0',
    }}>
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
      <Divider />
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <strong style={{ fontSize: 13 }}>B</strong>)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <em style={{ fontSize: 13 }}>I</em>)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <u style={{ fontSize: 13 }}>U</u>)}
      <Divider />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          List
        </>
      ))}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2.5V14"/>
          </svg>
          1. List
        </>
      ))}
      <Divider />
      <button
        onClick={() => fileRef.current?.click()}
        style={{ padding: '6px 9px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-mid)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        Image
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
      <button
        onClick={handleInsertDrawing}
        style={{ padding: '6px 9px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
        Draw
      </button>
    </div>
  );
}
