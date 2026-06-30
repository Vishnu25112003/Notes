import axios from 'axios';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/upload/image`, form);
  return res.data.url;
}
