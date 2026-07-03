import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import SimpleNote from '../models/SimpleNote.js';
import Section from '../models/Section.js';
import Page from '../models/Page.js';
import Drawing from '../models/Drawing.js';

/**
 * One-time, idempotent migration.
 *
 * Assigns all existing notes/sections/pages/drawings that have no owner to a
 * single user, so legacy (pre-multi-user) data stays private to that account.
 *
 * Usage:
 *   node src/scripts/backfillUserId.js            # assign to the oldest user
 *   node src/scripts/backfillUserId.js <username> # assign to a specific user
 */
async function run() {
  await connectDB();

  const username = process.argv[2];
  const owner = username
    ? await User.findOne({ username })
    : await User.findOne().sort({ createdAt: 1 });

  if (!owner) {
    console.error(
      username
        ? `No user found with username "${username}".`
        : 'No users exist yet. Register an account first, then re-run.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Assigning unowned documents to user "${owner.username}" (${owner._id})`);

  const filter = { userId: { $exists: false } };
  const update = { $set: { userId: owner._id } };

  const models = [
    ['SimpleNote', SimpleNote],
    ['Section', Section],
    ['Page', Page],
    ['Drawing', Drawing],
  ];

  for (const [name, Model] of models) {
    const { modifiedCount } = await Model.updateMany(filter, update);
    console.log(`  ${name}: ${modifiedCount} document(s) updated`);
  }

  console.log('Backfill complete.');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Backfill failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
