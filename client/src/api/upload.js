import axios from 'axios';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await axios.post('/api/upload/image', form);
  return res.data.url;
}
