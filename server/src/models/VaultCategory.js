import mongoose from 'mongoose';
import { cipherSchema } from './vaultSchemas.js';

// Custom categories only; the four built-in ones live in client code. Name, icon and field template are encrypted.
const vaultCategorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  data:   { type: cipherSchema, required: true },
}, { timestamps: true });

export default mongoose.model('VaultCategory', vaultCategorySchema);
