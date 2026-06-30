import mongoose from 'mongoose';

const webAuthnCredentialSchema = new mongoose.Schema({
  credentialID:        { type: String, required: true },
  credentialPublicKey: { type: String, required: true }, // base64url-encoded Uint8Array
  counter:             { type: Number, required: true, default: 0 },
  transports:          [{ type: String }],
  registeredAt:        { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  token:     { type: String, required: true },
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
  totpSecret:          { type: String, default: null },
  totpVerified:        { type: Boolean, default: false },
  webAuthnCredentials: [webAuthnCredentialSchema],
  sessions:            [sessionSchema],
}, { timestamps: true });

userSchema.index({ 'sessions.token': 1 });
userSchema.index({ 'webAuthnCredentials.credentialID': 1 });

export default mongoose.model('User', userSchema);
