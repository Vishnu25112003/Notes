import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

function limiter({ windowMs, limit, message, keyByUsername = false, onlyFailures = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // TRUST_PROXY=true is deliberate (see server.js); per-username limits cover the spoofing case
    validate: { trustProxy: false },
    // Per-username buckets stop distributed guessing against one account; IP buckets stop one client spraying many
    keyGenerator: keyByUsername
      ? req => `user:${String(req.body?.username || '').toLowerCase()}`
      : req => ipKeyGenerator(req.ip),
    handler: (req, res, next, options) => {
      const minutes = Math.ceil(options.windowMs / 60000);
      res.status(429).json({ error: `${message} Try again in ${minutes} minutes.` });
    },
  });
}

const FIFTEEN_MIN = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// A 6-digit code has 1,000,000 values; 5 wrong codes per 15 minutes per account makes guessing impractical.
// Successful logins don't count, so normal use never locks the owner out.
export const totpPerUser = limiter({
  windowMs: FIFTEEN_MIN, limit: 5, keyByUsername: true, onlyFailures: true,
  message: 'Too many authenticator attempts for this account.',
});

export const loginPerIp = limiter({
  windowMs: FIFTEEN_MIN, limit: 30,
  message: 'Too many sign-in attempts from this network.',
});

export const registerPerIp = limiter({
  windowMs: HOUR, limit: 20,
  message: 'Too many sign-up attempts from this network.',
});

// Broad ceiling for the authenticated API, generous enough for autosave
export const apiPerIp = limiter({
  windowMs: 60 * 1000, limit: 600,
  message: 'Too many requests.',
});
