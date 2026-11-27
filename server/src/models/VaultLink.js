import mongoose from 'mongoose';
import { cipherSchema } from './vaultSchemas.js';

// One QR "unlock this PC with my phone" request. Lives two minutes; MongoDB's TTL index removes it.
// The server only relays the phone's encrypted answer; the PC's key pair never leaves the PC
// (its public half travels inside the QR picture, not through this record).
const vaultLinkSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionHash: { type: String, required: true },   // only the login session that started it can collect the answer
  deviceName:  { type: String, maxlength: 80, default: 'Computer' },
  status:      { type: String, enum: ['pending', 'approved', 'consumed', 'cancelled'], default: 'pending' },
  phonePub:    { type: String, default: null },
  wrapped:     { type: cipherSchema, default: null },
  approvedFrom:{ type: String, default: null },
  expiresAt:   { type: Date, required: true },
}, { timestamps: true });

vaultLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VaultLink', vaultLinkSchema);
