import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [username, setUsername] = useState(null);

  useEffect(() => {
    // Drop the pre-cookie token left behind by older versions of the app
    try { localStorage.removeItem('ns_token'); } catch { /* storage unavailable */ }

    api.post('/auth/session/verify')
      .then(data => {
        if (data.valid) { setUsername(data.username); setStatus('authenticated'); }
        else setStatus('unauthenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  useEffect(() => {
    const handler = () => { setStatus('unauthenticated'); setUsername(null); };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  // The server has already set the session cookie by the time this runs
  const login = useCallback((user) => {
    setUsername(user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUsername(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
