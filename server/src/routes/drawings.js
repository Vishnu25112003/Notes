import { Router } from 'express';
import { createDrawing, getDrawing, updateDrawing, exportDrawing, deleteDrawing } from '../controllers/drawingsController.js';

const router = Router();
router.post('/', createDrawing);
router.get('/:id', getDrawing);
router.put('/:id', updateDrawing);
router.post('/:id/export', exportDrawing);
router.delete('/:id', deleteDrawing);
export default router;
