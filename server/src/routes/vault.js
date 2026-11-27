import { Router } from 'express';
import { requireVaultTicket } from '../middleware/requireVaultTicket.js';
import { vaultStepUpPerUser } from '../middleware/rateLimits.js';
import * as v from '../controllers/vaultController.js';

// Mounted behind requireAuth. Anything that returns key material or ciphertext also needs the vault ticket.
const router = Router();

router.get('/status', v.status);
router.post('/setup', v.setup);
router.post('/stepup/webauthn-options', v.stepUpWebAuthnOptions);
router.post('/stepup/webauthn-verify', vaultStepUpPerUser, v.stepUpWebAuthnVerify);
router.post('/stepup/totp', vaultStepUpPerUser, v.stepUpTotp);
router.post('/lock', v.lock);

router.use(requireVaultTicket);

router.get('/meta', v.getMeta);
router.put('/meta/password', v.changePassword);
router.put('/meta/recovery', v.changeRecovery);
router.put('/meta/settings', v.updateSettings);
router.delete('/meta', v.deleteVault);

router.post('/passkeys/add-options', v.passkeyAddOptions);
router.post('/passkeys/add-verify', v.passkeyAddVerify);
router.delete('/passkeys/:credentialID', v.passkeyRemove);

router.get('/items', v.listItems);
router.post('/items', v.createItem);
router.put('/items/:id', v.updateItem);
router.delete('/items/:id', v.trashItem);
router.post('/items/:id/restore', v.restoreItem);
router.delete('/items/:id/purge', v.purgeItem);

router.get('/categories', v.listCategories);
router.post('/categories', v.createCategory);
router.put('/categories/:id', v.updateCategory);
router.delete('/categories/:id', v.deleteCategory);

router.get('/recipients/:username', v.recipientKey);
router.get('/items/:id/shares', v.listItemShares);
router.post('/items/:id/shares', v.createShare);
router.delete('/shares/:shareId', v.revokeShare);
router.get('/shared', v.sharedWithMe);
router.delete('/shared/:shareId', v.leaveShare);

export default router;
