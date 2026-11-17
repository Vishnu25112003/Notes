import api from './client.js';

export const getSections = () => api.get('/sections');
export const createSection = (data) => api.post('/sections', data);
export const updateSection = (id, data) => api.put(`/sections/${id}`, data);
export const deleteSection = (id) => api.delete(`/sections/${id}`);
export const getSectionPages = (id) => api.get(`/sections/${id}/pages`);
export const reorderSectionPages = (id, data) => api.patch(`/sections/${id}/pages/reorder`, data);
