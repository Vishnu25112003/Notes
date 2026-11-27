import { vaultApi } from '../../api/vault.js';
import { createWithPrf, setDeviceCredential } from './passkey.js';
import { prfKek, wrapVaultKey, SLOT } from '../crypto/keys.js';
import { wipe } from '../crypto/encoding.js';

export function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'This device';
}

export function guessBrowser() {
  const ua = navigator.userAgent;
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'browser';
}

// Registers this device's own vault passkey and stores the Vault Key wrapped under its PRF-derived key.
// `rawVaultKey` comes from setup or a fresh master-password unwrap; it is not wiped here (the caller owns it).
export async function enrollThisDevice(rawVaultKey, deviceName = guessDeviceName()) {
  const { options } = await vaultApi.passkeyAddOptions();
  const { credential, prf, prfSalt, credentialID } = await createWithPrf(options);
  try {
    const wrappedKey = await wrapVaultKey(await prfKek(prf), rawVaultKey, SLOT.prf(credentialID));
    await vaultApi.passkeyAddVerify({ credential, prfSalt, wrappedKey, deviceName });
  } finally { wipe(prf); }
  setDeviceCredential(credentialID);
  return credentialID;
}
