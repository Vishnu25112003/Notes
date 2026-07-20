import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import '@excalidraw/excalidraw/index.css';
import { getDrawing, updateDrawing, exportDrawing } from '../../api/drawings.js';
import { solveDrawing } from '../../api/solve.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import Switch from '../ui/toggle-switch.jsx';

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
  const [autoSolve, setAutoSolve] = useState(true);
  const solvingRef = useRef(false);
  const autoTimerRef = useRef(null);
  const lastAutoSigRef = useRef('');

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

  const runSolve = useCallback(async ({ auto = false } = {}) => {
    if (!excalidrawAPI || solvingRef.current) return;
    const elements = excalidrawAPI.getSceneElements();

    // Only send the user's strokes to the solver — previous AI answers would
    // confuse the model and skew the answer placement
    const userElements = (elements || []).filter(el => !el.isDeleted && !el.customData?.aiAnswer);
    if (userElements.length === 0) {
      if (!auto) alert('Draw or write a question first, then tap SOLVE.');
      return;
    }

    // In auto mode, never re-solve content that hasn't changed since the last
    // attempt (element versions bump on every edit)
    const sig = userElements.map(el => `${el.id}:${el.version}`).join('|');
    if (auto && sig === lastAutoSigRef.current) return;
    lastAutoSigRef.current = sig;

    solvingRef.current = true;
    setSolving(true);
    try {
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Export the question strokes to a PNG (base64, no data: prefix)
      const { exportToBlob, convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({ elements: userElements, mimeType: 'image/png', appState, files });
      const pngBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const { answer, solution } = await solveDrawing({ pngBase64, auto });
      // In auto mode an empty answer means "still being written" — stay silent
      const text = (answer && answer.trim()) || (!auto && solution && solution.trim()) || '';
      if (!text) {
        if (!auto) alert('Could not read a question from the drawing. Try writing it more clearly.');
        return;
      }

      // Place the answer right after the question, on the same handwriting row
      // as the most recent stroke (i.e., just after the "=" sign)
      const last = userElements[userElements.length - 1];
      const lastTop = last.y;
      const lastBottom = last.y + last.height;
      const row = userElements.filter(el => el.y < lastBottom && el.y + el.height > lastTop);
      const rowTop = Math.min(...row.map(el => el.y));
      const rowBottom = Math.max(...row.map(el => el.y + el.height));
      const rowRight = Math.max(...row.map(el => el.x + el.width));
      const rowHeight = rowBottom - rowTop;

      // Match the answer size to the handwriting height (Excalidraw text line
      // height is ~1.25 × fontSize), and vertically center it on the row
      const fontSize = Math.min(Math.max(rowHeight * 0.8, 16), 120);
      const x = rowRight + fontSize * 0.4;
      const y = rowTop + (rowHeight - fontSize * 1.25) / 2;

      const newElements = convertToExcalidrawElements([
        {
          type: 'text',
          x,
          y,
          text,
          fontSize,
          strokeColor: '#e8590c',
        },
      ]).map(el => ({ ...el, customData: { aiAnswer: true } }));

      // Re-fetch the scene so strokes drawn while the solver was running
      // are not dropped
      const current = excalidrawAPI.getSceneElements();
      excalidrawAPI.updateScene({ elements: [...current, ...newElements] });
    } catch (e) {
      console.error('Solve error:', e);
      if (!auto) alert('Could not solve the drawing. Please try again.');
    } finally {
      solvingRef.current = false;
      setSolving(false);
    }
  }, [excalidrawAPI]);

  const handleSolve = useCallback(() => runSolve({ auto: false }), [runSolve]);

  // Auto-solve: after the pen has been idle for ~1.2s following a change,
  // run a silent solve (the backend only answers finished questions)
  const scheduleAutoSolve = useCallback(() => {
    if (!autoSolve) return;
    clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => runSolve({ auto: true }), 1200);
  }, [autoSolve, runSolve]);

  useEffect(() => {
    if (!autoSolve) clearTimeout(autoTimerRef.current);
    return () => clearTimeout(autoTimerRef.current);
  }, [autoSolve]);

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
          <span
            title="When on, questions are solved automatically as soon as you stop writing"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: autoSolve ? 'var(--accent)' : 'var(--text-mid)' }}
          >
            ✨ AUTO
            <span style={{ display: 'inline-block', transform: 'scale(0.6)', margin: '-11px -25px' }}>
              <Switch id="auto-solve" checked={autoSolve} onChange={setAutoSolve} label="Auto solve" />
            </span>
          </span>
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
              onChange={scheduleAutoSolve}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
