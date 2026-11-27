import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { fromB64, toB64, randomBytes } from '../crypto/encoding.js';

// WebAuthn PRF turns a fingerprint/face unlock into a stable 32-byte secret per (passkey, salt).
// That secret never leaves the browser: it is stripped from what we send to the server.

const DEVICE_KEY = 'ns_vault_device_cred';

export const getDeviceCredential = () => { try { return localStorage.getItem(DEVICE_KEY); } catch { return null; } };
export const setDeviceCredential = (id) => {
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch { /* ignore */ }
};

export const passkeysSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential;

function stripSecrets(credential) {
  // JSON would drop the ArrayBuffer anyway; removing it explicitly keeps the PRF output out of every request body
  const { clientExtensionResults: _prfSecret, ...rest } = credential;
  return { ...rest, clientExtensionResults: {} };
}

function prfFirst(credential) {
  const first = credential.clientExtensionResults?.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

export class PrfUnsupportedError extends Error {
  constructor() {
    super("This device's passkeys can't unlock the vault (no PRF support). Use your master password here.");
  }
}

// Unlock assertion: returns the server-shaped credential and the PRF output for the credential the person used
export async function assertWithPrf(optionsJSON, prfSalts, { onlyCredential } = {}) {
  const allow = onlyCredential
    ? optionsJSON.allowCredentials.filter(c => c.id === onlyCredential)
    : optionsJSON.allowCredentials;
  const evalByCredential = Object.fromEntries(
    allow.map(c => [c.id, { first: fromB64(prfSalts[c.id]) }])
  );
  const credential = await startAuthentication({
    optionsJSON: { ...optionsJSON, allowCredentials: allow.length ? allow : optionsJSON.allowCredentials, extensions: { prf: { evalByCredential } } },
  });
  const prf = prfFirst(credential);
  if (!prf) throw new PrfUnsupportedError();
  return { credential: stripSecrets(credential), prf, credentialID: credential.id };
}

// Enrolment: create a vault passkey and get its PRF output. Some authenticators only answer PRF on a later
// assertion, so fall back to one immediate assertion with the same salt.
export async function createWithPrf(optionsJSON) {
  const salt = randomBytes(32);
  const credential = await startRegistration({
    optionsJSON: { ...optionsJSON, extensions: { prf: { eval: { first: salt } } } },
  });
  const ext = credential.clientExtensionResults?.prf;
  let prf = prfFirst(credential);
  if (!prf && ext?.enabled === false) throw new PrfUnsupportedError();
  if (!prf) {
    const challenge = toB64(randomBytes(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const assertion = await startAuthentication({
      optionsJSON: {
        challenge,
        allowCredentials: [{ id: credential.id, type: 'public-key', transports: credential.response?.transports }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: salt } } },
      },
    });
    prf = prfFirst(assertion);
    if (!prf) throw new PrfUnsupportedError();
  }
  return { credential: stripSecrets(credential), prf, prfSalt: toB64(salt), credentialID: credential.id };
}

// Offline unlock: a local assertion (no server) just to get the PRF output again
export async function localPrf(credentialID, prfSaltB64) {
  const challenge = toB64(randomBytes(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const assertion = await startAuthentication({
    optionsJSON: {
      challenge,
      allowCredentials: [{ id: credentialID, type: 'public-key' }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: fromB64(prfSaltB64) } } },
    },
  });
  const prf = prfFirst(assertion);
  if (!prf) throw new PrfUnsupportedError();
  return prf;
}

export function describePasskeyError(err) {
  const name = err?.name || err?.cause?.name;
  if (name === 'NotAllowedError' || /not allowed|cancel/i.test(String(err?.message))) return 'Cancelled, or the passkey prompt timed out.';
  if (name === 'InvalidStateError') return 'This device already has a vault passkey.';
  return err?.message || String(err);
}
