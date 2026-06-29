import api from './client.js';

export const createDrawing = (data) => api.post('/drawings', data);
export const getDrawing = (id) => api.get(`/drawings/${id}`);
export const updateDrawing = (id, data) => api.put(`/drawings/${id}`, data);
export const exportDrawing = (id, data) => api.post(`/drawings/${id}/export`, data);
export const deleteDrawing = (id) => api.delete(`/drawings/${id}`);
