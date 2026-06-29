import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  { title: { type: String, required: true } },
  { timestamps: true }
);

sectionSchema.index({ updatedAt: -1 });

export default mongoose.model('Section', sectionSchema);
