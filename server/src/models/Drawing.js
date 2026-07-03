import mongoose from 'mongoose';

const drawingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
    sceneData: { type: Object, default: {} },
    exportUrl: { type: String, default: null },
  },
  { timestamps: true }
);

drawingSchema.index({ userId: 1, pageId: 1 });

export default mongoose.model('Drawing', drawingSchema);
