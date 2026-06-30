import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import api from './client.js';

// ── Registration ──────────────────────────────────────────────────────────────

export const checkUsername = (username) =>
  api.post('/auth/register/check-username', { username });

export async function registerWebAuthn(username) {
  const { options } = await api.post('/auth/register/webauthn-options', { username });
  const credential = await startRegistration({ optionsJSON: options });
  return api.post('/auth/register/webauthn-verify', { username, credential });
}

export const getTotpSetup = (username) =>
  api.post('/auth/register/totp-setup', { username });

export const verifyTotpSetup = (username, code) =>
  api.post('/auth/register/totp-verify', { username, code });

// ── Login ─────────────────────────────────────────────────────────────────────

export const checkUserExists = (username) =>
  api.post('/auth/login/check', { username });

export async function authenticateWebAuthn(username) {
  const { options } = await api.post('/auth/login/webauthn-options', { username });
  const credential = await startAuthentication({ optionsJSON: options });
  return api.post('/auth/login/webauthn-verify', { username, credential });
}

export const loginTotp = (username, code) =>
  api.post('/auth/login/totp', { username, code });

// ── Session ───────────────────────────────────────────────────────────────────

export const verifySession = (token) =>
  api.post('/auth/session/verify', {}, { headers: { Authorization: `Bearer ${token}` } });

export const logoutSession = (token) =>
  api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } });

// ── Add Device ────────────────────────────────────────────────────────────────

export async function addDevice(deviceName) {
  const { options } = await api.post('/auth/device/add-options');
  const credential = await startRegistration({ optionsJSON: options });
  return api.post('/auth/device/add-verify', { credential, deviceName });
}
