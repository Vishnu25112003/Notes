import api from './client.js';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const data = await api.post('/upload/image', form);
  return data.url;
}
