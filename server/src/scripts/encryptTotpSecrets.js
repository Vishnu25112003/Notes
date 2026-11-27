import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import { seal, isSealed, assertSecretBoxKey } from '../lib/secretBox.js';

/**
 * One-time, idempotent migration.
 *
 * Seals every plaintext TOTP secret with TOTP_ENC_KEY and drops legacy plaintext-token sessions.
 * Logins also seal a legacy secret on the fly, so this only closes the window for users who don't sign in.
 *
 * Usage: node src/scripts/encryptTotpSecrets.js
 */
async function run() {
  assertSecretBoxKey();
  await connectDB();

  const users = await User.find({ totpSecret: { $ne: null } }).select('totpSecret').lean();
  let sealed = 0;
  for (const u of users) {
    if (isSealed(u.totpSecret)) continue;
    await User.updateOne({ _id: u._id }, { $set: { totpSecret: seal(u.totpSecret) } });
    sealed++;
  }

  const legacy = await User.updateMany(
    { 'sessions.token': { $exists: true } },
    { $pull: { sessions: { tokenHash: { $exists: false } } } }
  );

  console.log(`Sealed ${sealed} of ${users.length} TOTP secrets; cleared legacy sessions on ${legacy.modifiedCount} users.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
