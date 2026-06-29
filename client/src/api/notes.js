import api from './client.js';

export const getNotes = () => api.get('/notes');
export const createNote = (data) => api.post('/notes', data);
export const getNote = (id) => api.get(`/notes/${id}`);
export const updateNote = (id, data) => api.put(`/notes/${id}`, data);
export const deleteNote = (id) => api.delete(`/notes/${id}`);
