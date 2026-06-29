import api from './client.js';

export const search = (q) => api.get(`/search?q=${encodeURIComponent(q)}`);
