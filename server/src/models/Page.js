import mongoose from 'mongoose';
import { shareSchema } from './shareSchema.js';

const pageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
    title: { type: String, default: 'Untitled Page' },
    content: { type: Object, default: {} },
    order: { type: Number, default: 0 },
    searchText: { type: String, default: '' },
    share: { type: shareSchema, default: () => ({}) },
  },
  { timestamps: true }
);

pageSchema.index({ title: 'text', searchText: 'text' });
pageSchema.index({ userId: 1, sectionId: 1 });
pageSchema.index({ parentId: 1 });
pageSchema.index({ 'share.sharedWith.userId': 1 });

export default mongoose.model('Page', pageSchema);
