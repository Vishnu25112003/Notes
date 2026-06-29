import mongoose from 'mongoose';

const drawingSchema = new mongoose.Schema(
  {
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
    sceneData: { type: Object, default: {} },
    exportUrl: { type: String, default: null },
  },
  { timestamps: true }
);

drawingSchema.index({ pageId: 1 });

export default mongoose.model('Drawing', drawingSchema);
