import mongoose from 'mongoose';
import { cipherSchema } from './vaultSchemas.js';

// The item key re-wrapped for one recipient with ECDH(ephemeral, recipient) + HKDF. Read-only for the recipient.
const vaultShareSchema = new mongoose.Schema({
  itemId:            { type: mongoose.Schema.Types.ObjectId, ref: 'VaultItem', required: true, index: true },
  ownerId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerUsername:     { type: String, required: true },
  recipientId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientUsername: { type: String, required: true },
  recipientKey:      { type: String, required: true }, // the public key the owner wrapped for, to detect key changes
  wrappedItemKey:    { type: cipherSchema, required: true },
  ephemeralPub:      { type: String, required: true },
}, { timestamps: true });

vaultShareSchema.index({ itemId: 1, recipientId: 1 }, { unique: true });

export default mongoose.model('VaultShare', vaultShareSchema);
