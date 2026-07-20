import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import '@excalidraw/excalidraw/index.css';
import { getDrawing, updateDrawing, exportDrawing } from '../../api/drawings.js';
import { solveDrawing } from '../../api/solve.js';
import { useTheme } from '../../context/ThemeContext.jsx';

const ExcalidrawLazy = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
);

const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
  </svg>
);

export default function DrawingCanvas({ drawingId, onClose, onSaved }) {
  const { theme } = useTheme();
  const [initialData, setInitialData] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saving, setSaving] = useState(false);
  const [solving, setSolving] = useState(false);
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
    if (!excalidrawAPI || !drawingId) return false;
    setSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const sceneData = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } };
      await updateDrawing(drawingId, { sceneData });

      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({ elements, mimeType: 'image/png', appState, files });
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const updated = await exportDrawing(drawingId, { pngBase64: base64 });
      window.dispatchEvent(new CustomEvent('drawing-saved', {
        detail: { drawingId, exportUrl: updated.exportUrl },
      }));
      if (onSaved) onSaved(updated.exportUrl);
      return true;
    } catch (e) {
      console.error('Drawing save error:', e);
      alert('Could not save the drawing. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [excalidrawAPI, drawingId, onSaved]);

  const handleSolve = useCallback(async () => {
    if (!excalidrawAPI || solving) return;
    const elements = excalidrawAPI.getSceneElements();
    if (!elements || elements.length === 0) {
      alert('Draw or write a question first, then tap SOLVE.');
      return;
    }
    setSolving(true);
    try {
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Export the current canvas to a PNG (base64, no data: prefix)
      const { exportToBlob, convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({ elements, mimeType: 'image/png', appState, files });
      const pngBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const { answer, solution } = await solveDrawing({ pngBase64 });
      const text = (answer && answer.trim()) || (solution && solution.trim());
      if (!text) {
        alert('Could not read a question from the drawing. Try writing it more clearly.');
        return;
      }

      // Place the answer at the center of the current viewport, in scene coordinates
      const zoom = appState.zoom?.value || 1;
      const vw = appState.width || window.innerWidth;
      const vh = appState.height || window.innerHeight;
      const sceneX = (vw / 2) / zoom - appState.scrollX;
      const sceneY = (vh / 2) / zoom - appState.scrollY;

      const newElements = convertToExcalidrawElements([
        {
          type: 'text',
          x: sceneX,
          y: sceneY,
          text,
          fontSize: 36,
          strokeColor: '#e8590c',
        },
      ]);

      excalidrawAPI.updateScene({ elements: [...elements, ...newElements] });
    } catch (e) {
      console.error('Solve error:', e);
      alert('Could not solve the drawing. Please try again.');
    } finally {
      setSolving(false);
    }
  }, [excalidrawAPI, solving]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          padding: '10px 14px', flexShrink: 0,
          borderBottom: '1px solid var(--border-faint)',
        }}
      >
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: 'var(--accent)' }}><PencilIcon /></span>
          Drawing
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}>
          <button
            onClick={handleSolve}
            disabled={solving || saving}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: (solving || saving) ? 'not-allowed' : 'pointer', opacity: (solving || saving) ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >{solving ? 'SOLVING…' : '✨ SOLVE'}</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >{saving ? 'SAVING…' : 'SAVE'}</button>
          <button
            onClick={async () => { const ok = await handleSave(); if (ok) onClose(); }}
            disabled={saving}
            style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >SAVE &amp; CLOSE</button>
          <button
            onClick={onClose}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >CLOSE</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ width: '100%', flex: 1, minHeight: 0, position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-label)' }}>
            LOADING CANVAS…
          </div>
        ) : (
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-label)' }}>
              LOADING…
            </div>
          }>
            <ExcalidrawLazy
              excalidrawAPI={(api) => setExcalidrawAPI(api)}
              initialData={initialData}
              theme={theme}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
