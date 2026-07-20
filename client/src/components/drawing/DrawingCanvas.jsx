import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import '@excalidraw/excalidraw/index.css';
import { getDrawing, updateDrawing, exportDrawing } from '../../api/drawings.js';
import { solveDrawing } from '../../api/solve.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import PowerButton from '../ui/power-button.jsx';

const ExcalidrawLazy = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
);

// How long the pen must stay idle before an auto-solve fires. Long enough
// to survive the pauses between words when writing a text question, short
// enough that math answers still feel instant.
const AUTO_SOLVE_IDLE_MS = 2500;

// Answers longer than this go below the question as a wrapped paragraph
// instead of inline after the "=" (Excalidraw text never wraps on its own)
const INLINE_ANSWER_MAX_CHARS = 30;

const wrapText = (str, maxCharsPerLine) => {
  const lines = [];
  for (const paragraph of str.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line.length + 1 + word.length) > maxCharsPerLine) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
};

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
  const [toast, setToast] = useState(null);
  const solvingRef = useRef(false);
  const autoTimerRef = useRef(null);
  const lastAutoSigRef = useRef('');
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const handleAutoToggle = useCallback((next) => {
    setAutoSolve(next);
    showToast(next ? 'Auto mode ON' : 'Auto mode OFF');
  }, [showToast]);

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

      let x, y, fontSize, displayText;
      if (text.length <= INLINE_ANSWER_MAX_CHARS && !text.includes('\n')) {
        // Short answer: inline right after the "=", matching the handwriting
        // height (Excalidraw text line height is ~1.25 × fontSize) and
        // vertically centered on the row
        fontSize = Math.min(Math.max(rowHeight * 0.8, 16), 120);
        x = rowRight + fontSize * 0.4;
        y = rowTop + (rowHeight - fontSize * 1.25) / 2;
        displayText = text;
      } else {
        // Long answer: wrapped paragraph below the question, kept within the
        // visible viewport width so it never runs off the screen
        const rowLeft = Math.min(...row.map(el => el.x));
        fontSize = Math.min(Math.max(rowHeight * 0.35, 16), 28);
        const zoom = appState.zoom?.value || 1;
        const viewportRight = (appState.width || window.innerWidth) / zoom - appState.scrollX;
        const availableWidth = Math.max(260, viewportRight - rowLeft - 40);
        const maxChars = Math.max(24, Math.floor(availableWidth / (fontSize * 0.6)));
        displayText = wrapText(text, maxChars);
        x = rowLeft;
        y = rowBottom + fontSize;
      }

      const newElements = convertToExcalidrawElements([
        {
          type: 'text',
          x,
          y,
          text: displayText,
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

  // Auto-solve: once the pen goes idle after a change, run a silent solve
  // (the backend only answers finished questions)
  const scheduleAutoSolve = useCallback(() => {
    if (!autoSolve) return;
    clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => runSolve({ auto: true }), AUTO_SOLVE_IDLE_MS);
  }, [autoSolve, runSolve]);

  useEffect(() => {
    if (!autoSolve) clearTimeout(autoTimerRef.current);
    return () => clearTimeout(autoTimerRef.current);
  }, [autoSolve]);

  // Clear the toast hide-timer only on unmount — clearing it whenever
  // autoSolve changes would cancel the timer right after each toggle,
  // leaving the toast stuck on screen
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 68, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          padding: '9px 18px', borderRadius: 8,
          background: 'var(--accent)', color: 'var(--accent-fg)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
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
          {solving && (
            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              SOLVING…
            </span>
          )}
          <PowerButton
            on={autoSolve}
            onClick={() => handleAutoToggle(!autoSolve)}
            title="Auto solve: answers appear automatically when you stop writing"
            size={36}
          />
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
