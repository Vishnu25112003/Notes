import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { generateSecret, generate as generateTotp, verify as verifyTotp, generateURI } from 'otplib';
import qrcode from 'qrcode';
import { randomUUID } from 'crypto';
import User from '../models/User.js';
import { setChallenge, getChallenge, deleteChallenge } from '../lib/challengeStore.js';

const RP_NAME   = 'Notespace';
const RP_ID     = process.env.RP_ID || 'localhost';
const RP_ORIGIN = process.env.RP_ORIGIN || 'http://localhost:5173';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,20}$/;

// Pending multi-step registrations: username → { credential, totpSecret, expiresAt }
const pendingRegistrations = new Map();
const PENDING_TTL = 30 * 60 * 1000;

// WebAuthn auth failure tracking: username → { count, expiresAt }
const authFailures = new Map();

function createSession() {
  return {
    token: randomUUID(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    createdAt: new Date(),
  };
}

function addSessionToUser(user) {
  const session = createSession();
  user.sessions = user.sessions.filter(s => s.expiresAt > new Date());
  if (user.sessions.length >= 10) user.sessions.shift();
  user.sessions.push(session);
  return session;
}

// ── Registration ──────────────────────────────────────────────────────────────

export async function checkUsername(req, res) {
  const { username } = req.body;
  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–20 alphanumeric characters only' });
  }
  const existing = await User.findOne({ username, totpVerified: true });
  if (existing) return res.status(400).json({ error: 'Username is already taken' });
  res.json({ ok: true });
}

export async function webAuthnRegisterOptions(req, res) {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const existing = await User.findOne({ username, totpVerified: true });
  if (existing) return res.status(400).json({ error: 'Username already taken' });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userID: Buffer.from(username),
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
  });

  setChallenge(`reg:${username}`, options.challenge);
  // Strip rpId from options: mobile browsers (Chrome Android, iOS Safari) throw a
  // SecurityError when rp.id is explicitly set on shared-hosting domains (*.onrender.com).
  // Omitting it makes the browser default to the current page's domain silently.
  const clientOptions = { ...options, rp: { name: options.rp.name } };
  res.json({ options: clientOptions });
}

export async function webAuthnRegisterVerify(req, res) {
  const { username, credential } = req.body;
  if (!username || !credential) return res.status(400).json({ error: 'Missing fields' });

  const expectedChallenge = getChallenge(`reg:${username}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Challenge expired, please start registration over' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return res.status(400).json({ error: `WebAuthn verification failed: ${err.message}` });
  }

  deleteChallenge(`reg:${username}`);
  if (!verification.verified) return res.status(400).json({ error: 'WebAuthn verification failed' });

  const { credential: cred } = verification.registrationInfo;
  const pending = pendingRegistrations.get(username) || { totpSecret: null };
  pending.credential = {
    credentialID:        cred.id,
    credentialPublicKey: isoBase64URL.fromBuffer(cred.publicKey),
    counter:             cred.counter,
    transports:          cred.transports || [],
  };
  pending.expiresAt = Date.now() + PENDING_TTL;
  pendingRegistrations.set(username, pending);

  res.json({ ok: true });
}

export async function totpSetup(req, res) {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  if (!USERNAME_REGEX.test(username)) return res.status(400).json({ error: 'Invalid username' });

  const existing = await User.findOne({ username, totpVerified: true });
  if (existing) return res.status(400).json({ error: 'Username already registered' });

  const secret = generateSecret();
  const otpauthUrl = await generateURI({ strategy: 'totp', issuer: RP_NAME, label: username, secret });
  const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

  const pending = pendingRegistrations.get(username) || { credential: null };
  pending.totpSecret = secret;
  pending.expiresAt = Date.now() + PENDING_TTL;
  pendingRegistrations.set(username, pending);

  res.json({ qrDataUrl, secret });
}

export async function totpVerifySetup(req, res) {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: 'Missing fields' });

  const pending = pendingRegistrations.get(username);
  if (!pending?.totpSecret || Date.now() > pending.expiresAt) {
    return res.status(400).json({ error: 'Registration session expired, please start over' });
  }

  const result = await verifyTotp({ token: code, secret: pending.totpSecret });
  if (!result.valid) return res.status(401).json({ error: 'Invalid TOTP code' });

  const user = new User({
    username,
    totpSecret:          pending.totpSecret,
    totpVerified:        true,
    webAuthnCredentials: pending.credential ? [pending.credential] : [],
  });

  const session = addSessionToUser(user);
  await user.save();
  pendingRegistrations.delete(username);

  res.json({ token: session.token, username });
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginCheck(req, res) {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const user = await User.findOne({ username, totpVerified: true });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ exists: true, hasWebAuthn: user.webAuthnCredentials.length > 0 });
}

export async function webAuthnAuthOptions(req, res) {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const user = await User.findOne({ username, totpVerified: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.webAuthnCredentials.length) {
    return res.status(400).json({ error: 'No WebAuthn credentials registered' });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.webAuthnCredentials.map(c => ({ id: c.credentialID })),
    userVerification: 'preferred',
  });

  setChallenge(`auth:${username}`, options.challenge);
  const { rpId: _rpId, ...clientOptions } = options;
  res.json({ options: clientOptions });
}

export async function webAuthnAuthVerify(req, res) {
  const { username, credential } = req.body;
  if (!username || !credential) return res.status(400).json({ error: 'Missing fields' });

  const failures = authFailures.get(username);
  if (failures?.count >= 3 && Date.now() < failures.expiresAt) {
    return res.status(401).json({
      error: 'Too many failed attempts, please use Authenticator App',
      maxAttemptsReached: true,
    });
  }

  const expectedChallenge = getChallenge(`auth:${username}`);
  if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired' });

  const user = await User.findOne({ username, totpVerified: true });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const storedCred = user.webAuthnCredentials.find(c => c.credentialID === credential.id);
  if (!storedCred) return res.status(400).json({ error: 'Credential not recognized' });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id:        storedCred.credentialID,
        publicKey: isoBase64URL.toBuffer(storedCred.credentialPublicKey),
        counter:   storedCred.counter,
        transports: storedCred.transports,
      },
    });
  } catch (err) {
    const f = authFailures.get(username) || { count: 0, expiresAt: Date.now() + 5 * 60 * 1000 };
    f.count++;
    authFailures.set(username, f);
    return res.status(400).json({ error: `Verification failed: ${err.message}` });
  }

  deleteChallenge(`auth:${username}`);
  authFailures.delete(username);

  if (!verification.verified) return res.status(400).json({ error: 'Verification failed' });

  storedCred.counter = verification.authenticationInfo.newCounter;
  const session = addSessionToUser(user);
  await user.save();

  res.json({ token: session.token, username });
}

export async function loginTotp(req, res) {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: 'Missing fields' });

  const user = await User.findOne({ username, totpVerified: true });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const result = await verifyTotp({ token: code, secret: user.totpSecret });
  if (!result.valid) return res.status(401).json({ error: 'Invalid TOTP code' });

  const session = addSessionToUser(user);
  await user.save();

  res.json({ token: session.token, username });
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function sessionVerify(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.json({ valid: false });

  const user = await User.findOne({ 'sessions.token': token });
  if (!user) return res.json({ valid: false });

  const session = user.sessions.find(s => s.token === token);
  if (!session || session.expiresAt < new Date()) return res.json({ valid: false });

  res.json({ valid: true, username: user.username });
}

export async function sessionLogout(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (token) {
    await User.findOneAndUpdate(
      { 'sessions.token': token },
      { $pull: { sessions: { token } } }
    );
  }
  res.json({ ok: true });
}

// ── Add Device (authenticated) ────────────────────────────────────────────────

export async function addDeviceOptions(req, res) {
  const { id, username } = req.user;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userID: Buffer.from(username),
    attestationType: 'none',
    excludeCredentials: user.webAuthnCredentials.map(c => ({ id: c.credentialID })),
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
  });

  setChallenge(`adddev:${username}`, options.challenge);
  const clientOptions = { ...options, rp: { name: options.rp.name } };
  res.json({ options: clientOptions });
}

export async function addDeviceVerify(req, res) {
  const { id, username } = req.user;
  const { credential, deviceName } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credential required' });

  const expectedChallenge = getChallenge(`adddev:${username}`);
  if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired' });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return res.status(400).json({ error: `Verification failed: ${err.message}` });
  }

  deleteChallenge(`adddev:${username}`);
  if (!verification.verified) return res.status(400).json({ error: 'Verification failed' });

  const { credential: cred } = verification.registrationInfo;
  await User.findByIdAndUpdate(id, {
    $push: {
      webAuthnCredentials: {
        credentialID:        cred.id,
        credentialPublicKey: isoBase64URL.fromBuffer(cred.publicKey),
        counter:             cred.counter,
        transports:          cred.transports || [],
        registeredAt:        new Date(),
      },
    },
  });

  res.json({ ok: true });
}
