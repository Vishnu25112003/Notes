import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import '@excalidraw/excalidraw/index.css';
import { getDrawing, updateDrawing, exportDrawing } from '../../api/drawings.js';

const ExcalidrawLazy = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
);

const HEADER_HEIGHT = 57;

const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
  </svg>
);

export default function DrawingCanvas({ drawingId, onClose, onSaved }) {
  const [initialData, setInitialData] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drawingId) return;
    getDrawing(drawingId)
      .then(d => {
        setInitialData(d.sceneData && Object.keys(d.sceneData).length > 0 ? d.sceneData : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [drawingId]);

  const handleSave = useCallback(async () => {
    if (!excalidrawAPI || !drawingId) return;
    setSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const sceneData = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } };
      await updateDrawing(drawingId, { sceneData });

      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({ elements, mimeType: 'image/png', appState, files });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const updated = await exportDrawing(drawingId, { pngBase64: base64 });
        if (onSaved) onSaved(updated.exportUrl);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Drawing save error:', e);
    } finally {
      setSaving(false);
    }
  }, [excalidrawAPI, drawingId, onSaved]);

  const canvasHeight = typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : 600;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#08080a' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', height: HEADER_HEIGHT, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#f4f4f6', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: '#7c6cff' }}><PencilIcon /></span>
          Drawing
        </span>
        <div style={{ display: 'flex', gap: 9, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 15px', borderRadius: 7, border: 'none', background: '#7c6cff', color: '#0a0a0c', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}
          >{saving ? 'SAVING…' : 'SAVE'}</button>
          <button
            onClick={async () => { await handleSave(); onClose(); }}
            disabled={saving}
            style={{ padding: '8px 15px', borderRadius: 7, border: 'none', background: '#7c6cff', color: '#0a0a0c', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}
          >SAVE &amp; CLOSE</button>
          <button
            onClick={onClose}
            style={{ padding: '8px 15px', borderRadius: 7, border: '1px solid #2e2e36', background: 'transparent', color: '#c8c8d0', cursor: 'pointer' }}
          >CLOSE</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ width: '100%', height: canvasHeight, position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#55555f' }}>
            LOADING CANVAS…
          </div>
        ) : (
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#55555f' }}>
              LOADING…
            </div>
          }>
            <ExcalidrawLazy
              excalidrawAPI={(api) => setExcalidrawAPI(api)}
              initialData={initialData}
              theme="dark"
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
