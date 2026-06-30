import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ns_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r.data,
  e => {
    if (e.response?.status === 401) {
      localStorage.removeItem('ns_token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(e.response?.data?.error || e.message);
  }
);

export default api;
