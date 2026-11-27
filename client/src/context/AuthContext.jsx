import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);
const LAST_USER = 'ns_last_user';

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [username, setUsername] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Drop the pre-cookie token left behind by older versions of the app
    try { localStorage.removeItem('ns_token'); } catch { /* storage unavailable */ }

    api.post('/auth/session/verify')
      .then(data => {
        if (data.valid) {
          setUsername(data.username); setStatus('authenticated');
          try { localStorage.setItem(LAST_USER, data.username); } catch { /* ignore */ }
        } else setStatus('unauthenticated');
      })
      .catch((err) => {
        // No connection is not the same as signed out: let the last user reach the encrypted offline vault.
        // Every other page still needs the server, and the vault itself asks for the master password.
        const last = (() => { try { return localStorage.getItem(LAST_USER); } catch { return null; } })();
        if (last && (navigator.onLine === false || err === 'Network Error')) {
          setUsername(last); setOffline(true); setStatus('authenticated');
        } else setStatus('unauthenticated');
      });
  }, []);

  useEffect(() => {
    const handler = () => { setStatus('unauthenticated'); setUsername(null); };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  // The server has already set the session cookie by the time this runs
  const login = useCallback((user) => {
    setUsername(user);
    setOffline(false);
    try { localStorage.setItem(LAST_USER, user); } catch { /* ignore */ }
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    try { localStorage.removeItem(LAST_USER); } catch { /* ignore */ }
    // Signing out removes this device's encrypted vault copy too, for shared computers
    if (username) import('../vault/lib/offlineStore.js').then(m => m.offlineStore.clear(username)).catch(() => {});
    setUsername(null);
    setStatus('unauthenticated');
  }, [username]);

  return (
    <AuthContext.Provider value={{ status, username, offline, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
