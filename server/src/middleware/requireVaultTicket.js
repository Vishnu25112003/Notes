import VaultMeta from '../models/VaultMeta.js';
import { findTicket, needsRefresh, refreshCookie, ticketTtlMs } from '../lib/vaultTicket.js';

// Runs after requireAuth. 403 { vaultLocked: true } tells the client to step up again.
export async function requireVaultTicket(req, res, next) {
  const meta = await VaultMeta.findOne({ userId: req.user.id });
  if (!meta) return res.status(404).json({ error: 'Vault is not set up', vaultMissing: true });
  const ticket = findTicket(req, meta);
  if (!ticket) return res.status(403).json({ error: 'Vault is locked', vaultLocked: true });
  if (needsRefresh(ticket, meta)) {
    const expiresAt = new Date(Date.now() + ticketTtlMs(meta));
    await VaultMeta.updateOne(
      { _id: meta._id, 'tickets.tokenHash': ticket.tokenHash },
      { $set: { 'tickets.$.expiresAt': expiresAt } }
    );
    ticket.expiresAt = expiresAt;
    refreshCookie(req, res, meta);
  }
  req.vaultMeta = meta;
  req.vaultTicket = ticket;
  next();
}
