import { useEffect, useRef, useState } from 'react';

export function useAutosave(saveFn, deps, delay = 900) {
  const [status, setStatus] = useState('saved');
  const timer = useRef(null);
  const isFirstRun = useRef(true);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveFnRef.current();
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delay);
    return () => clearTimeout(timer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return status;
}
