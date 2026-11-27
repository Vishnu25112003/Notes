import axios from 'axios';

// Same-origin in every environment: Vite proxies /api in dev, Vercel rewrites /api to Render in production.
// The session lives in an httpOnly cookie, so no token is ever readable from JavaScript.
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

api.interceptors.response.use(
  r => r.data,
  e => {
    if (e.response?.status === 401) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(e.response?.data?.error || e.message);
  }
);

export default api;
