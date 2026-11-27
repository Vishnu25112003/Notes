import User from '../models/User.js';
import { getRequestToken, hashToken } from '../lib/session.js';

export async function findSessionUser(req) {
  const token = getRequestToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const user = await User.findOne({ 'sessions.tokenHash': tokenHash });
  if (!user) return null;
  const session = user.sessions.find(s => s.tokenHash === tokenHash);
  if (!session || session.expiresAt < new Date()) return null;
  return user;
}

export async function requireAuth(req, res, next) {
  const user = await findSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { id: user._id, username: user.username };
  next();
}
