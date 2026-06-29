import mongoose from 'mongoose';

const simpleNoteSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Untitled' },
    content: { type: Object, default: {} },
    searchText: { type: String, default: '' },
  },
  { timestamps: true }
);

simpleNoteSchema.index({ title: 'text', searchText: 'text' });

export default mongoose.model('SimpleNote', simpleNoteSchema);
