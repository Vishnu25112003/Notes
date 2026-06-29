import mongoose from 'mongoose';

const pageSchema = new mongoose.Schema(
  {
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
    title: { type: String, default: 'Untitled Page' },
    content: { type: Object, default: {} },
    order: { type: Number, default: 0 },
    searchText: { type: String, default: '' },
  },
  { timestamps: true }
);

pageSchema.index({ title: 'text', searchText: 'text' });
pageSchema.index({ sectionId: 1 });
pageSchema.index({ parentId: 1 });

export default mongoose.model('Page', pageSchema);
