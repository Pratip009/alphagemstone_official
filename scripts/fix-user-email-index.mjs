/**
 * One-time migration: replace the old case-sensitive unique index on
 * `users.email` with a case-insensitive collated one, matching what
 * src/models/User.ts now declares.
 *
 * Why this is needed: Mongoose's `autoIndex` only ever ADDS indexes that
 * are missing — it never drops an index that's no longer declared in the
 * schema. So simply changing the schema (as this fix does) is not enough;
 * the old `email_1` unique index from before this fix will keep silently
 * enforcing case-sensitive uniqueness in the live database until it's
 * dropped here.
 *
 * Run with:  node scripts/fix-user-email-index.mjs
 * Requires MONGODB_URI in environment or .env file.
 *
 * Safe to run multiple times — it's idempotent.
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment or .env file.');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
try {
  await client.connect();
  const db = client.db();
  const users = db.collection('users');
  console.log(`Connected to database: "${db.databaseName}"`);

  const indexes = await users.indexes();
  console.log('\nCurrent indexes:');
  for (const idx of indexes) console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);

  const dupes = await users
    .aggregate([
      { $group: { _id: { $toLower: { $trim: { input: '$email' } } }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (dupes.length > 0) {
    console.log('\n⚠️  Found duplicate accounts sharing the same email (case/whitespace-insensitive):');
    for (const d of dupes) console.log(`  - "${d._id}": ${d.count} accounts -> ${d.ids.join(', ')}`);
    console.log('\nResolve these manually (decide which _id to keep) before re-running this');
    console.log('script — building the case-insensitive unique index will fail while');
    console.log('duplicates exist.');
    process.exit(1);
  }

  const oldIndex = indexes.find(
    (idx) => JSON.stringify(idx.key) === JSON.stringify({ email: 1 }) && !idx.collation
  );
  if (oldIndex) {
    console.log(`\nDropping old index "${oldIndex.name}"...`);
    await users.dropIndex(oldIndex.name);
  } else {
    console.log('\nNo old case-sensitive email index found — nothing to drop.');
  }

  console.log('Creating case-insensitive unique index "email_unique_ci"...');
  await users.createIndex(
    { email: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 }, name: 'email_unique_ci' }
  );

  console.log('\n✅ Done. Indexes now:');
  for (const idx of await users.indexes()) {
    console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' [unique]' : ''}${idx.collation ? ` collation=${JSON.stringify(idx.collation)}` : ''}`);
  }
} finally {
  await client.close();
}