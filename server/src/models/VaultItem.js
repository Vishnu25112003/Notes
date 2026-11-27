import mongoose from 'mongoose';
import { cipherSchema } from './vaultSchemas.js';

// Everything a person would recognise (title, URL, username, password, notes, favourite) lives inside `data`.
// The client binds itemId + version into the AES-GCM AAD, so ciphertext can't be swapped between items.
const vaultItemSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  categoryId:     { type: String, required: true, maxlength: 40 },
  wrappedItemKey: { type: cipherSchema, required: true },
  data:           { type: cipherSchema, required: true },
  version:        { type: Number, required: true, default: 1 },
  deletedAt:      { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('VaultItem', vaultItemSchema);
