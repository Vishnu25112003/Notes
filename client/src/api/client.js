import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

api.interceptors.response.use(
  r => r.data,
  e => Promise.reject(e.response?.data?.error || e.message)
);

export default api;
