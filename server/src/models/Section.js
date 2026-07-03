import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

sectionSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('Section', sectionSchema);
