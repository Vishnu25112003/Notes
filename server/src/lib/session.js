import { createHash, randomBytes } from 'crypto';

export const SESSION_COOKIE = 'ns_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 10;

const isProd = () => process.env.NODE_ENV === 'production';

// Only the hash is stored, so a database leak does not hand out live sessions
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function getRequestToken(req) {
  return req.cookies?.[SESSION_COOKIE] || null;
}

// Issues a new session on the user document (caller saves) and returns the raw token for the cookie
export function addSessionToUser(user) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  // Legacy plaintext-token sessions have no tokenHash; dropping them here logs those devices out once
  user.sessions = user.sessions.filter(s => s.tokenHash && s.expiresAt > now);
  while (user.sessions.length >= MAX_SESSIONS) user.sessions.shift();
  user.sessions.push({
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    createdAt: now,
  });
  return token;
}

const cookieOptions = () => ({
  httpOnly: true,
  // Safari refuses Secure cookies on http://localhost, so only require HTTPS in production
  secure: isProd(),
  sameSite: 'strict',
  path: '/api',
});

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_DURATION_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
