import mongoose from 'mongoose';

const webAuthnCredentialSchema = new mongoose.Schema({
  credentialID:        { type: String, required: true },
  credentialPublicKey: { type: String, required: true }, // base64url-encoded Uint8Array
  counter:             { type: Number, required: true, default: 0 },
  transports:          [{ type: String }],
  registeredAt:        { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  // sha256 of the cookie token; the raw token is never stored
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9]{3,20}$/,
  },
  // AES-GCM sealed ("v1:..."); legacy plaintext values are sealed on next login or by scripts/encryptTotpSecrets.js
  totpSecret:          { type: String, default: null },
  totpVerified:        { type: Boolean, default: false },
  // Last accepted TOTP time step; codes at or before it are rejected as replays
  totpLastStep:        { type: Number, default: null },
  webAuthnCredentials: [webAuthnCredentialSchema],
  sessions:            [sessionSchema],
}, { timestamps: true });

userSchema.index({ 'sessions.tokenHash': 1 });
userSchema.index({ 'webAuthnCredentials.credentialID': 1 });

export default mongoose.model('User', userSchema);
