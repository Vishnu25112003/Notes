import { Router } from 'express';
import { solveDrawing } from '../controllers/solveController.js';

const router = Router();
router.post('/', solveDrawing);
export default router;
