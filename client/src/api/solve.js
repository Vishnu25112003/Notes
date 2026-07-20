import api from './client.js';

// Sends a PNG (base64, no data: prefix) of the current canvas to the solver.
// Returns { answer, solution }.
export const solveDrawing = (data) => api.post('/solve', data);
