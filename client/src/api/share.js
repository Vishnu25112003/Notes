import api from './client.js';

// Receiver
export const getSharedWithMe = () => api.get('/share/shared-with-me');
export const resolveShared = (type, id) => api.get(`/share/${type}/${id}`);
export const saveShared = (type, id, data) => api.put(`/share/${type}/${id}/content`, data);
export const requestAccess = (type, id) => api.post(`/share/${type}/${id}/request`);
export const cloneShared = (type, id) => api.post(`/share/${type}/${id}/clone`);

// Owner
export const getPendingRequestCount = () => api.get('/share/requests/count');
export const getShareSettings = (type, id) => api.get(`/share/${type}/${id}/settings`);
export const updateShareSettings = (type, id, data) => api.put(`/share/${type}/${id}/settings`, data);
export const addShareUser = (type, id, username) => api.post(`/share/${type}/${id}/users`, { username });
export const removeShareUser = (type, id, userId) => api.delete(`/share/${type}/${id}/users/${userId}`);
export const approveRequest = (type, id, userId) => api.post(`/share/${type}/${id}/requests/${userId}/approve`);
export const denyRequest = (type, id, userId) => api.delete(`/share/${type}/${id}/requests/${userId}`);
