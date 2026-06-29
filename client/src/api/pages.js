import api from './client.js';

export const createPage = (data) => api.post('/pages', data);
export const getPage = (id) => api.get(`/pages/${id}`);
export const updatePage = (id, data) => api.put(`/pages/${id}`, data);
export const deletePage = (id) => api.delete(`/pages/${id}`);
export const movePage = (id, data) => api.patch(`/pages/${id}/move`, data);
