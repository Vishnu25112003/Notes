import mongoose from 'mongoose';
import { cipherSchema } from './vaultSchemas.js';

// One per user. Holds only wrapped (encrypted) keys and non-secret settings; the server can't unwrap any of them.
const vaultPasskeySchema = new mongoose.Schema({
  credentialID:        { type: String, required: true },
  credentialPublicKey: { type: String, required: true },
  counter:             { type: Number, default: 0 },
  transports:          [{ type: String }],
  prfSalt:             { type: String, required: true },   // base64, not secret
  wrappedKey:          { type: cipherSchema, required: true }, // Vault Key under the PRF-derived key
  deviceName:          { type: String, maxlength: 60, default: 'Device' },
  addedAt:             { type: Date, default: Date.now },
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  tokenHash:   { type: String, required: true },
  sessionHash: { type: String, required: true }, // dies with the login session it was issued to
  expiresAt:   { type: Date, required: true },
  issuedAt:    { type: Date, default: Date.now }, // when the step-up happened; approving a QR unlock needs a fresh one
}, { _id: false });

const vaultMetaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  kdf: {
    alg:  { type: String, enum: ['argon2id'], default: 'argon2id' },
    salt: { type: String, required: true },
    m:    { type: Number, required: true }, // KiB
    t:    { type: Number, required: true },
    p:    { type: Number, required: true },
  },
  wrappedKeyPwd:      { type: cipherSchema, required: true },
  wrappedKeyRecovery: { type: cipherSchema, required: true },
  passkeys:           [vaultPasskeySchema],
  ecdhPublicKey:      { type: String, required: true },      // base64 raw P-256 point, readable for sharing
  wrappedEcdhPrivate: { type: cipherSchema, required: true },
  settings: {
    autoLockMinutes: { type: Number, enum: [1, 5, 15, 30], default: 5 },
  },
  tickets:     [ticketSchema],
  lastPurgeAt: { type: Date, default: null },
}, { timestamps: true });

vaultMetaSchema.index({ 'tickets.tokenHash': 1 });

export default mongoose.model('VaultMeta', vaultMetaSchema);
