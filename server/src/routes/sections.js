import { Router } from 'express';
import { listSections, createSection, updateSection, deleteSection } from '../controllers/sectionsController.js';
import { getPageTree, reorderPages } from '../controllers/pagesController.js';

const router = Router();
router.get('/', listSections);
router.post('/', createSection);
router.put('/:id', updateSection);
router.delete('/:id', deleteSection);
router.get('/:id/pages', getPageTree);
router.patch('/:id/pages/reorder', reorderPages);
export default router;
