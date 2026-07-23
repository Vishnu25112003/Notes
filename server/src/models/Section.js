import mongoose from 'mongoose';
import { shareSchema } from './shareSchema.js';

const sectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    share: { type: shareSchema, default: () => ({}) },
  },
  { timestamps: true }
);

sectionSchema.index({ userId: 1, updatedAt: -1 });
sectionSchema.index({ 'share.sharedWith.userId': 1 });

export default mongoose.model('Section', sectionSchema);
