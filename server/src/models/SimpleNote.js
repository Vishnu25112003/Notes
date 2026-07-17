import mongoose from 'mongoose';
import { shareSchema } from './shareSchema.js';

const simpleNoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled' },
    content: { type: Object, default: {} },
    searchText: { type: String, default: '' },
    share: { type: shareSchema, default: () => ({}) },
  },
  { timestamps: true }
);

simpleNoteSchema.index({ title: 'text', searchText: 'text' });
simpleNoteSchema.index({ userId: 1, updatedAt: -1 });
simpleNoteSchema.index({ 'share.sharedWith.userId': 1 });

export default mongoose.model('SimpleNote', simpleNoteSchema);
