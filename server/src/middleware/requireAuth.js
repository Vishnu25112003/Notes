import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const user = await User.findOne({ 'sessions.token': token });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const session = user.sessions.find(s => s.token === token);
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.user = { id: user._id, username: user.username };
  next();
}
