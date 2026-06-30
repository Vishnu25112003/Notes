import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [username, setUsername] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('ns_token');
    if (!token) { setStatus('unauthenticated'); return; }

    api.post('/auth/session/verify', {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(data => {
        if (data.valid) { setUsername(data.username); setStatus('authenticated'); }
        else { localStorage.removeItem('ns_token'); setStatus('unauthenticated'); }
      })
      .catch(() => { localStorage.removeItem('ns_token'); setStatus('unauthenticated'); });
  }, []);

  useEffect(() => {
    const handler = () => { setStatus('unauthenticated'); setUsername(null); };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback((token, user) => {
    localStorage.setItem('ns_token', token);
    setUsername(user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('ns_token');
    if (token) {
      await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem('ns_token');
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
