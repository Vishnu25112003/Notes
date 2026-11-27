import mongoose from 'mongoose';

// AES-GCM ciphertext produced in the browser: base64 iv + base64 ciphertext (tag appended by WebCrypto)
export const cipherSchema = new mongoose.Schema({
  iv: { type: String, required: true, maxlength: 64 },
  ct: { type: String, required: true },
}, { _id: false });
