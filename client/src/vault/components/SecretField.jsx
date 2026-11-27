import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useVault } from '../VaultContext.jsx';
import { useToast } from './Toast.jsx';
import { copySecret, CLIPBOARD_SECONDS } from '../lib/clipboard.js';

const MASK = '••••••••••';

// One labelled value in an item. Secrets stay masked; revealing or copying one asks you to re-verify
// unless you did so in the last 60 seconds.
export default function SecretField({ label, value, secret = false, link = false, multiline = false }) {
  const { ensureVerified } = useVault();
  const toast = useToast();
  const [shown, setShown] = useState(false);

  // Hide again after a short while so a revealed password doesn't sit on screen
  useEffect(() => {
    if (!shown) return undefined;
    const t = setTimeout(() => setShown(false), 30000);
    return () => clearTimeout(t);
  }, [shown]);

  if (!value) return null;

  async function reveal() {
    if (shown) { setShown(false); return; }
    try { await ensureVerified(`Show ${label.toLowerCase()}`); setShown(true); } catch { /* cancelled */ }
  }

  async function copy() {
    try {
      if (secret) await ensureVerified(`Copy ${label.toLowerCase()}`);
      await copySecret(value, { onCleared: secret ? () => toast('Clipboard cleared') : undefined });
      toast(secret ? `Copied. Clipboard clears in ${CLIPBOARD_SECONDS} s` : 'Copied');
    } catch (err) {
      if (err?.message !== 'Cancelled' && err?.message !== 'Vault locked') toast("Couldn't copy. Your browser blocked clipboard access.");
    }
  }

  const masked = secret && !shown;
  let display = masked ? MASK : value;
  if (link && !masked) {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    display = <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textUnderlineOffset: 3 }}>{value}</a>;
  }

  return (
    <div className="v-frow">
      <div className="v-frow-label">{label}</div>
      <div className={`v-frow-value${secret ? ' secret' : ''}${masked ? ' masked' : ''}${multiline ? ' v-notes' : ''}`} aria-label={masked ? `${label}, hidden` : undefined}>
        {display}
      </div>
      <div className="v-frow-tools">
        {secret && (
          <button type="button" className="v-btn icon ghost" onClick={reveal} aria-label={shown ? `Hide ${label}` : `Show ${label}`} aria-pressed={shown}>
            <Icon name={shown ? 'eyeOff' : 'eye'} />
          </button>
        )}
        {!multiline && (
          <button type="button" className="v-btn icon ghost" onClick={copy} aria-label={`Copy ${label}`}>
            <Icon name="copy" />
          </button>
        )}
      </div>
    </div>
  );
}
