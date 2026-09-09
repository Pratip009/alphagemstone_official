/**
 * Backfill script — run with: node scripts/backfill-product-slugs.mjs
 * Requires MONGODB_URI in environment or .env / .env.local file.
 *
 * Why this exists
 * ----------------
 * Product.slug is a new field (see src/models/Product.ts) that the Mongoose
 * pre('validate') hook now auto-generates for every NEW or re-saved product.
 * It does nothing for products that are already sitting in the DB and never
 * get saved again, so the existing catalogue needs a one-time pass to fill
 * `slug` in on every doc that's missing it.
 *
 * This script is idempotent and non-destructive: it only ever queries for
 * docs where `slug` doesn't exist yet, and only ever sets that one field.
 * Safe to re-run (e.g. after a fresh import) — it will simply do nothing on
 * a second run once every product has a slug.
 *
 * Collision handling: builds an in-memory Set of every slug already in use
 * (both pre-existing ones and ones assigned earlier in this same run), and
 * appends -2, -3, ... to the base slug until it finds one that's free. This
 * mirrors the collision logic in the Product model's pre('validate') hook,
 * but does it against an in-memory Set instead of one DB round-trip per
 * document — the model's own hook still re-checks against the DB for any
 * future single-document save, this script just needs to be fast over the
 * whole catalogue in one pass.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

// dotenv's default config() only reads a file literally named `.env` — it
// will NOT pick up `.env.local`. Load both, `.env.local` second so it can
// override `.env` if both happen to exist (mirrors Next.js's own precedence).
config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set (env, .env, or .env.local). Aborting.');
  process.exit(1);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Minimal schema — strict:false so we can read/write any field without
// redeclaring the full Product model here (same pattern as the other
// backfill-*.mjs scripts in this folder).
const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to db:', mongoose.connection.name);

  const totalProducts = await Product.countDocuments({});
  console.log('Total products:', totalProducts);
  if (totalProducts === 0) {
    console.error('0 documents found — check MONGODB_URI db name / collection name.');
    await mongoose.disconnect();
    return;
  }

  // Preload every slug already in use so new candidates can be checked
  // in-memory instead of hitting the DB per document.
  const existingSlugDocs = await Product.find({ slug: { $exists: true, $ne: null, $ne: '' } })
    .select('slug')
    .lean();
  const usedSlugs = new Set(existingSlugDocs.map((d) => d.slug));
  console.log('Products that already have a slug:', usedSlugs.size);

  const stats = { scanned: 0, updated: 0, skippedNoName: 0 };

  const cursor = Product.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  }).cursor();

  let bulkOps = [];
  const BATCH_SIZE = 500;

  async function flush() {
    if (bulkOps.length === 0) return;
    await Product.bulkWrite(bulkOps, { ordered: false });
    bulkOps = [];
  }

  for await (const doc of cursor) {
    stats.scanned++;

    if (!doc.name || !String(doc.name).trim()) {
      stats.skippedNoName++;
      continue;
    }

    const base = slugify(doc.name) || 'product';
    let candidate = base;
    let suffix = 1;
    while (usedSlugs.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    usedSlugs.add(candidate);

    bulkOps.push({
      updateOne: { filter: { _id: doc._id }, update: { $set: { slug: candidate } } },
    });
    stats.updated++;

    if (bulkOps.length >= BATCH_SIZE) await flush();

    if (stats.scanned % 2000 === 0) {
      console.log(`...scanned ${stats.scanned}, updated ${stats.updated} so far`);
    }
  }

  await flush();

  console.log('\n--- Results ---');
  console.log('Scanned (missing slug):', stats.scanned);
  console.log('Slugs assigned:', stats.updated);
  console.log('Skipped (no name to slugify):', stats.skippedNoName);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
