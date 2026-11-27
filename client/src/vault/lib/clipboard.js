// Copies a secret and clears the clipboard 30 s later, unless something else was copied since.
// Known limit: a browser can't clear the clipboard while another app is in front, and keyboard
// clipboard history (Gboard, Windows Win+V) keeps its own copy.
const CLEAR_AFTER_MS = 30 * 1000;
let timer = null;
let lastCopied = null;
let pendingClear = false;

async function clear() {
  try {
    // Only clear if our value is still there, when the browser lets us read it
    const current = await navigator.clipboard.readText().catch(() => null);
    if (current === null || current === lastCopied) await navigator.clipboard.writeText('');
    lastCopied = null;
    pendingClear = false;
  } catch {
    pendingClear = true; // not focused; try again when the page is visible
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pendingClear) clear();
});

export async function copySecret(text, { onCleared } = {}) {
  await navigator.clipboard.writeText(text);
  lastCopied = text;
  clearTimeout(timer);
  timer = setTimeout(async () => { await clear(); onCleared?.(); }, CLEAR_AFTER_MS);
}

export function clearClipboardNow() {
  if (!lastCopied) return;
  clearTimeout(timer);
  clear();
}

export const CLIPBOARD_SECONDS = CLEAR_AFTER_MS / 1000;
