import { Router } from 'express';
import { createPage, getPage, updatePage, deletePage, movePage } from '../controllers/pagesController.js';

const router = Router();
router.post('/', createPage);
router.get('/:id', getPage);
router.put('/:id', updatePage);
router.delete('/:id', deletePage);
router.patch('/:id/move', movePage);
export default router;
