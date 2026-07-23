import { Router } from 'express';
import {
  listSharedWithMe,
  pendingRequestCount,
  getShareSettings,
  updateShareSettings,
  addShareUser,
  removeShareUser,
  approveRequest,
  denyRequest,
  resolveShared,
  updateSharedContent,
  requestAccess,
  cloneShared,
  createSectionPage,
} from '../controllers/shareController.js';

const router = Router();

// Static routes must come before /:type/:id
router.get('/shared-with-me', listSharedWithMe);
router.get('/requests/count', pendingRequestCount);

router.get('/:type/:id/settings', getShareSettings);
router.put('/:type/:id/settings', updateShareSettings);
router.post('/:type/:id/users', addShareUser);
router.delete('/:type/:id/users/:userId', removeShareUser);
router.post('/:type/:id/requests/:userId/approve', approveRequest);
router.delete('/:type/:id/requests/:userId', denyRequest);
router.put('/:type/:id/content', updateSharedContent);
router.post('/:type/:id/pages', createSectionPage);
router.post('/:type/:id/request', requestAccess);
router.post('/:type/:id/clone', cloneShared);
router.get('/:type/:id', resolveShared);

export default router;
