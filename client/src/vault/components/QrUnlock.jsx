import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useVault } from '../VaultContext.jsx';
import { vaultApi } from '../../api/vault.js';
import Icon from './Icon.jsx';
import { newLinkKeyPair, linkUrl, matchCode, openAnswer } from '../lib/link.js';
import { guessDeviceName, guessBrowser } from '../lib/enroll.js';

const POLL_MS = 1500;

// PC side of "unlock with your phone". Works in any browser: no passkey support needed on this computer.
export default function QrUnlock({ onBack }) {
  const { unlockWithLinkAnswer } = useVault();
  const [state, setState] = useState({ phase: 'starting' }); // starting | waiting | opening | expired | error
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(120);
  const linkRef = useRef(null); // { id, privateKey, expiresAt }

  const start = useCallback(async () => {
    setState({ phase: 'starting' }); setQr(null);
    try {
      const { privateKey, pub } = await newLinkKeyPair();
      const { id, expiresAt } = await vaultApi.linkStart(`${guessDeviceName()} · ${guessBrowser()}`);
      linkRef.current = { id, privateKey, expiresAt: new Date(expiresAt).getTime() };
      const url = linkUrl(id, pub);
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0a0c', light: '#ffffff' } });
      setQr(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      setCode(await matchCode(id, pub));
      setState({ phase: 'waiting' });
    } catch (err) {
      setState({ phase: 'error', message: err.message });
    }
  }, []);

  useEffect(() => { start(); }, [start]);

  // Poll for the phone's answer, and count down
  useEffect(() => {
    if (state.phase !== 'waiting') return undefined;
    let stopped = false;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((linkRef.current.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setState({ phase: 'expired' });
    }, 1000);
    const poll = async () => {
      if (stopped) return;
      try {
        const r = await vaultApi.linkPoll(linkRef.current.id);
        if (r.status === 'approved') {
          setState({ phase: 'opening', from: r.approvedFrom });
          const raw = await openAnswer(linkRef.current.privateKey, linkRef.current.id, r);
          await unlockWithLinkAnswer(raw);
          return;
        }
        if (r.status === 'expired' || r.status === 'cancelled' || r.status === 'consumed') { setState({ phase: 'expired' }); return; }
      } catch (err) {
        if (!err.offline) { setState({ phase: 'error', message: err.message }); return; }
      }
      if (!stopped) setTimeout(poll, POLL_MS);
    };
    setTimeout(poll, POLL_MS);
    return () => { stopped = true; clearInterval(tick); };
  }, [state.phase, unlockWithLinkAnswer]);

  // Leaving the screen withdraws the request
  useEffect(() => () => {
    const l = linkRef.current;
    if (l && Date.now() < l.expiresAt) vaultApi.linkCancel(l.id).catch(() => {});
  }, []);

  return (
    <div>
      {state.phase === 'waiting' || state.phase === 'starting' ? (
        <>
          <div className="v-qr" aria-busy={state.phase === 'starting'}>
            {qr ? <img src={qr} alt="QR code to unlock this computer with your phone" width="232" height="232" /> : <span className="v-hint">Making a QR code…</span>}
          </div>
          <ol className="v-qr-steps">
            <li>Open your phone's camera and point it at the code.</li>
            <li>Tap the link, then confirm with your fingerprint on the phone.</li>
            <li>Check the phone shows <strong className="mono tnum">{code || '··· ···'}</strong></li>
          </ol>
          <p className="v-hint tnum" role="status" style={{ textAlign: 'center' }}>
            Waiting for your phone · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        </>
      ) : state.phase === 'opening' ? (
        <div className="v-empty" style={{ padding: '32px 0' }}>
          <Icon name="unlock" size={30} />
          <div className="v-h2">Approved{state.from ? ` on ${state.from}` : ''}</div>
          <div>Decrypting your vault…</div>
        </div>
      ) : state.phase === 'expired' ? (
        <div className="v-empty" style={{ padding: '28px 0' }}>
          <Icon name="history" size={30} />
          <div className="v-h2">QR code expired</div>
          <button type="button" className="v-btn primary" onClick={start}><Icon name="refresh" size={16} /> Show a new code</button>
        </div>
      ) : (
        <div className="v-error" role="alert">{state.message}</div>
      )}
      <p className="v-hint">Your phone must be signed in to Notespace as you, with its Vault set up. The key travels encrypted for this computer only.</p>
      <button type="button" className="v-btn block" style={{ marginTop: 8 }} onClick={onBack}>Use another way</button>
    </div>
  );
}
