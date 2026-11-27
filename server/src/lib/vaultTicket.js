import { randomBytes } from 'crypto';
import { hashToken, getRequestToken } from './session.js';

// Gate 1 of the two-gate unlock. A ticket is issued only after a fresh passkey (user verification required)
// or authenticator step-up, and is needed to download any wrapped key or ciphertext.
// A stolen login session alone can't read the vault.
export const VAULT_COOKIE = 'ns_vault';
const MAX_TICKETS = 10;
const REFRESH_AFTER_MS = 30 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';
const cookieOptions = () => ({ httpOnly: true, secure: isProd(), sameSite: 'strict', path: '/api/vault' });

export const ticketTtlMs = (meta) => Math.min(Math.max(meta?.settings?.autoLockMinutes || 5, 1), 30) * 60 * 1000;

// Adds a ticket to `meta` (caller saves) and sets the cookie
export function issueTicket(req, res, meta) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const sessionToken = getRequestToken(req);
  meta.tickets = (meta.tickets || []).filter(t => t.expiresAt.getTime() > now);
  while (meta.tickets.length >= MAX_TICKETS) meta.tickets.shift();
  meta.tickets.push({
    tokenHash: hashToken(token),
    sessionHash: hashToken(sessionToken || ''),
    expiresAt: new Date(now + ticketTtlMs(meta)),
  });
  res.cookie(VAULT_COOKIE, token, { ...cookieOptions(), maxAge: ticketTtlMs(meta) });
}

export function clearTicketCookie(res) {
  res.clearCookie(VAULT_COOKIE, cookieOptions());
}

// Returns the matching live ticket on `meta`, or null
export function findTicket(req, meta) {
  const token = req.cookies?.[VAULT_COOKIE];
  const sessionToken = getRequestToken(req);
  if (!token || !sessionToken || !meta) return null;
  const tokenHash = hashToken(token);
  const t = meta.tickets.find(x => x.tokenHash === tokenHash);
  if (!t || t.expiresAt.getTime() <= Date.now()) return null;
  if (t.sessionHash !== hashToken(sessionToken)) return null;
  return t;
}

// Sliding expiry: activity keeps the vault open up to the auto-lock window after the last request
export function needsRefresh(ticket, meta) {
  const target = Date.now() + ticketTtlMs(meta);
  return target - ticket.expiresAt.getTime() > REFRESH_AFTER_MS;
}

export function refreshCookie(req, res, meta) {
  res.cookie(VAULT_COOKIE, req.cookies[VAULT_COOKIE], { ...cookieOptions(), maxAge: ticketTtlMs(meta) });
}
