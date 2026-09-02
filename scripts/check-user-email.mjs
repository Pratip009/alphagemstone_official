/**
 * Diagnostic: check exactly what's in the `users` collection for an email.
 *
 * Run with:  node scripts/check-user-email.mjs someone@example.com
 * Requires MONGODB_URI in .env.local (or .env) in the current directory.
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Next.js convention is `.env.local`, not `.env` — dotenv's config() only
// loads `.env` by default, so without this, MONGODB_URI silently isn't
// found even though it's sitting right there in .env.local.
const envLocal = resolve(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  config({ path: envLocal });
} else {
  config(); // fall back to .env
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/check-user-email.mjs <email>');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment or .env file.');
  process.exit(1);
}

const needle = email.trim().toLowerCase();

const client = new MongoClient(MONGODB_URI);
try {
  await client.connect();
  const db = client.db();
  console.log(`Connected to database: "${db.databaseName}"`);
  console.log(`(cluster/host from URI: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//<redacted>@').split('/')[2]})\n`);

  const users = db.collection('users');

  const exact = await users.find({ email: needle }).toArray();
  const fuzzy = await users
    .find({ email: { $regex: `^\\s*${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } })
    .toArray();

  console.log(`Exact match ("${needle}"): ${exact.length} document(s)`);
  console.log(`Case/whitespace-insensitive match: ${fuzzy.length} document(s)\n`);

  const all = fuzzy.length ? fuzzy : exact;
  if (all.length === 0) {
    console.log('✅ No document found for this email in this database.');
    console.log('   If the app still says "already exists" for this exact email, the');
    console.log('   app is almost certainly connected to a DIFFERENT MongoDB URI than');
    console.log('   this script — check MONGODB_URI in your deployment (e.g. Vercel).');
  } else {
    for (const doc of all) {
      console.log('Found document:');
      console.log(`  _id:        ${doc._id}`);
      console.log(`  email:      ${JSON.stringify(doc.email)}  (raw, showing exact bytes)`);
      console.log(`  name:       ${doc.name}`);
      console.log(`  role:       ${doc.role}`);
      console.log(`  createdAt:  ${doc.createdAt}`);
      console.log();
    }
    console.log('⚠️  This email still exists in this database. Delete this exact');
    console.log('   _id if you want to free up the email for re-registration.');
  }

  const indexes = await users.indexes();
  console.log('\nIndexes on `users`:');
  for (const idx of indexes) {
    console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' [unique]' : ''}${idx.collation ? ` collation=${JSON.stringify(idx.collation)}` : ''}`);
  }
} finally {
  await client.close();
}