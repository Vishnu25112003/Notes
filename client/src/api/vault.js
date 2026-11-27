import axios from 'axios';

// Separate instance from api/client.js: vault calls need the status code and flags (vaultLocked, conflict, the
// server's copy on a 409), and must tell "offline" apart from "rejected".
const http = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api/vault`, timeout: 30000 });

export class VaultApiError extends Error {
  constructor(message, { status = 0, data = {}, offline = false } = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.offline = offline;
  }
}

http.interceptors.response.use(
  r => r.data,
  e => {
    if (!e.response) {
      return Promise.reject(new VaultApiError("Can't reach the server", { offline: true }));
    }
    if (e.response.status === 401) window.dispatchEvent(new Event('auth:expired'));
    if (e.response.data?.vaultLocked) window.dispatchEvent(new Event('vault:ticket-expired'));
    return Promise.reject(new VaultApiError(e.response.data?.error || e.message, { status: e.response.status, data: e.response.data }));
  }
);

export const vaultApi = {
  status: () => http.get('/status'),
  setup: (body) => http.post('/setup', body),
  stepUpOptions: () => http.post('/stepup/webauthn-options'),
  stepUpVerify: (credential) => http.post('/stepup/webauthn-verify', { credential }),
  stepUpTotp: (code) => http.post('/stepup/totp', { code }),
  lock: () => http.post('/lock'),
  meta: () => http.get('/meta'),
  changePassword: (body) => http.put('/meta/password', body),
  changeRecovery: (body) => http.put('/meta/recovery', body),
  updateSettings: (body) => http.put('/meta/settings', body),
  deleteVault: () => http.delete('/meta', { data: { confirm: 'DELETE VAULT' } }),
  passkeyAddOptions: () => http.post('/passkeys/add-options'),
  passkeyAddVerify: (body) => http.post('/passkeys/add-verify', body),
  passkeyRemove: (id) => http.delete(`/passkeys/${encodeURIComponent(id)}`),
  items: () => http.get('/items'),
  createItem: (body) => http.post('/items', body),
  updateItem: (id, body) => http.put(`/items/${id}`, body),
  trashItem: (id) => http.delete(`/items/${id}`),
  restoreItem: (id) => http.post(`/items/${id}/restore`),
  purgeItem: (id) => http.delete(`/items/${id}/purge`),
  categories: () => http.get('/categories'),
  createCategory: (body) => http.post('/categories', body),
  updateCategory: (id, body) => http.put(`/categories/${id}`, body),
  deleteCategory: (id) => http.delete(`/categories/${id}`),
  recipient: (username) => http.get(`/recipients/${encodeURIComponent(username)}`),
  itemShares: (id) => http.get(`/items/${id}/shares`),
  createShare: (id, body) => http.post(`/items/${id}/shares`, body),
  revokeShare: (shareId) => http.delete(`/shares/${shareId}`),
  shared: () => http.get('/shared'),
  leaveShare: (shareId) => http.delete(`/shared/${shareId}`),
};

// Fire-and-forget lock that survives the tab being hidden or closed
export function lockBeacon() {
  try {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/vault/lock`, { method: 'POST', keepalive: true, credentials: 'same-origin' });
  } catch { /* best effort */ }
}
