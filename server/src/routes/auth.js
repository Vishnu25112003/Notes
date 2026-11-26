import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { totpPerUser, loginPerIp, registerPerIp } from '../middleware/rateLimits.js';
import {
  checkUsername,
  webAuthnRegisterOptions,
  webAuthnRegisterVerify,
  totpSetup,
  totpVerifySetup,
  loginCheck,
  webAuthnAuthOptions,
  webAuthnAuthVerify,
  loginTotp,
  sessionVerify,
  sessionLogout,
  addDeviceOptions,
  addDeviceVerify,
} from '../controllers/authController.js';

const router = Router();

// Registration
router.use('/register', registerPerIp);
router.post('/register/check-username',   checkUsername);
router.post('/register/webauthn-options', webAuthnRegisterOptions);
router.post('/register/webauthn-verify',  webAuthnRegisterVerify);
router.post('/register/totp-setup',       totpSetup);
router.post('/register/totp-verify',      totpPerUser, totpVerifySetup);

// Login
router.use('/login', loginPerIp);
router.post('/login/check',              loginCheck);
router.post('/login/webauthn-options',   webAuthnAuthOptions);
router.post('/login/webauthn-verify',    webAuthnAuthVerify);
router.post('/login/totp',               totpPerUser, loginTotp);

// Session
router.post('/session/verify', sessionVerify);
router.post('/logout',         sessionLogout);

// Add device (authenticated user adds new biometric device)
router.post('/device/add-options', requireAuth, addDeviceOptions);
router.post('/device/add-verify',  requireAuth, addDeviceVerify);

export default router;
