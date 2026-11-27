import { useEffect, useState } from 'react';
import { checkStrength, STRENGTH_LABELS } from '../crypto/strength.js';

export default function StrengthMeter({ password, userInputs = [], onScore }) {
  const [result, setResult] = useState({ score: 0, warning: '', suggestions: [] });
  const inputsKey = userInputs.join('|');
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      checkStrength(password, inputsKey ? inputsKey.split('|') : []).then(r => {
        if (!live) return;
        setResult(r);
        onScore?.(password ? r.score : -1);
      });
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [password, inputsKey, onScore]);

  if (!password) return null;
  const tip = result.warning || result.suggestions[0];
  return (
    <div>
      <div className="v-meter" data-score={result.score} aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="v-hint" aria-live="polite">
        {STRENGTH_LABELS[result.score]}{tip ? ` · ${tip}` : ''}
      </div>
    </div>
  );
}
