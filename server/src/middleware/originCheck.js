const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defence in depth next to SameSite=Strict: a state-changing request that names a foreign Origin is refused.
// Requests without an Origin header (curl, server-to-server) carry no cookie from a browser on another site.
export function originCheck(allowedOrigins) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin?.replace(/\/$/, '');
    if (!origin || allowedOrigins.includes(origin)) return next();
    res.status(403).json({ error: 'Request origin not allowed' });
  };
}
