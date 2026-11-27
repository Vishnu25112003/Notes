import { useCallback, useEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';
import { generatePassword, generatePassphrase } from '../crypto/generator.js';

const PREF_KEY = 'ns_vault_gen';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || null; } catch { return null; } };

export default function PasswordGenerator({ onUse, onClose }) {
  const [opts, setOpts] = useState(() => loadPrefs() || { mode: 'password', length: 20, upper: true, lower: true, digits: true, symbols: true, words: 6 });
  const [value, setValue] = useState('');

  const regen = useCallback(() => {
    setValue(opts.mode === 'password' ? generatePassword(opts) : generatePassphrase({ words: opts.words }));
  }, [opts]);

  useEffect(() => {
    regen();
    try { localStorage.setItem(PREF_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
  }, [opts, regen]);

  const set = (patch) => setOpts(o => ({ ...o, ...patch }));

  return (
    <Dialog
      title="Generate a password"
      onClose={onClose}
      footer={<>
        <button type="button" className="v-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="v-btn primary" data-autofocus onClick={() => onUse(value)}>Use this password</button>
      </>}
    >
      <div className="v-input-group" style={{ marginTop: 10 }}>
        <output className="v-input mono" style={{ overflowWrap: 'anywhere', fontSize: 15.5 }} aria-label="Generated password">{value}</output>
        <button type="button" className="v-btn icon" onClick={regen} aria-label="Generate another"><Icon name="refresh" /></button>
      </div>

      <div className="v-chips" role="group" aria-label="Type" style={{ margin: '16px 0 12px' }}>
        <button type="button" className="v-chip" aria-pressed={opts.mode === 'password'} onClick={() => set({ mode: 'password' })}>Random characters</button>
        <button type="button" className="v-chip" aria-pressed={opts.mode === 'passphrase'} onClick={() => set({ mode: 'passphrase' })}>Passphrase</button>
      </div>

      {opts.mode === 'password' ? (
        <>
          <label className="v-label" htmlFor="gen-len">Length: <span className="tnum">{opts.length}</span></label>
          <input id="gen-len" type="range" min="8" max="64" value={opts.length} onChange={e => set({ length: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--vault)' }} />
          <div className="v-grid-2" style={{ marginTop: 8 }}>
            {[['upper', 'A–Z'], ['lower', 'a–z'], ['digits', '0–9'], ['symbols', '!@#$']].map(([k, label]) => (
              <label key={k} className="v-check">
                <input type="checkbox" checked={opts[k]} onChange={e => set({ [k]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className="v-label" htmlFor="gen-words">Words: <span className="tnum">{opts.words}</span></label>
          <input id="gen-words" type="range" min="4" max="10" value={opts.words} onChange={e => set({ words: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--vault)' }} />
          <p className="v-hint">Easier to type on a TV or phone. Use 6 words or more for anything important.</p>
        </>
      )}
    </Dialog>
  );
}
