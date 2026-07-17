import mongoose from 'mongoose';

const sharedUserSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized — usernames are immutable in this app
    username: { type: String, required: true },
    via: { type: String, enum: ['granted', 'approved', 'public'], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const accessRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Default state (private, nobody granted) means "not shared" — no enabled flag needed
export const shareSchema = new mongoose.Schema(
  {
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    permission: { type: String, enum: ['view', 'edit'], default: 'view' },
    allowClone: { type: Boolean, default: false },
    sharedWith: { type: [sharedUserSchema], default: [] },
    requests: { type: [accessRequestSchema], default: [] },
  },
  { _id: false }
);
