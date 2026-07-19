/**
 * Diagnoses what's actually stored in the `images` field across ALL
 * products in MongoDB — separate from what's on Cloudinary. This explains
 * discrepancies like "18k products but only 16 Cloudinary images".
 *
 * Categorizes every image URL found into buckets:
 *   - cloudinary   -> res.cloudinary.com/<your cloud>/...
 *   - other-cdn    -> some other https:// host (Unsplash, another CDN, etc.)
 *   - local-path   -> relative path like /images/foo.png (served from /public)
 *   - empty        -> product has no images at all
 *
 * USAGE
 * ─────
 *   node scripts/diagnose-product-images.mjs
 *   node scripts/diagnose-product-images.mjs --sample 20   (show 20 example URLs per bucket)
 *
 * Requires MONGODB_URI in .env.local or .env.
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';

config({ path: '.env.local' });
config();

function getArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const sampleSize = parseInt(getArg('sample') || '5', 10);

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const ProductSchema = new mongoose.Schema({}, { strict: false });
  const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

  const totalProducts = await Product.countDocuments();
  console.log(`Total products in DB: ${totalProducts}\n`);

  const buckets = {
    cloudinary: [],
    'other-cdn': [],
    'local-path': [],
  };
  let emptyCount = 0;
  let totalImageRefs = 0;
  const distinctUrls = new Set();

  const cursor = Product.find({}).select('images').lean().cursor();

  for await (const product of cursor) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) {
      emptyCount++;
      continue;
    }
    for (const url of images) {
      if (typeof url !== 'string' || !url) continue;
      totalImageRefs++;
      distinctUrls.add(url);

      if (url.includes('res.cloudinary.com')) {
        if (buckets.cloudinary.length < sampleSize) buckets.cloudinary.push(url);
      } else if (url.startsWith('http')) {
        if (buckets['other-cdn'].length < sampleSize) buckets['other-cdn'].push(url);
      } else {
        if (buckets['local-path'].length < sampleSize) buckets['local-path'].push(url);
      }
    }
  }

  // Recount properly (the sample arrays cap at sampleSize, need real counts)
  const counts = { cloudinary: 0, 'other-cdn': 0, 'local-path': 0 };
  const cursor2 = Product.find({}).select('images').lean().cursor();
  for await (const product of cursor2) {
    const images = Array.isArray(product.images) ? product.images : [];
    for (const url of images) {
      if (typeof url !== 'string' || !url) continue;
      if (url.includes('res.cloudinary.com')) counts.cloudinary++;
      else if (url.startsWith('http')) counts['other-cdn']++;
      else counts['local-path']++;
    }
  }

  console.log(`Products with NO images at all: ${emptyCount} (${((emptyCount / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`Total image references across all products: ${totalImageRefs}`);
  console.log(`Distinct image URLs (accounting for repeats/placeholders): ${distinctUrls.size}\n`);

  console.log('Breakdown by source:');
  console.log(`  Cloudinary URLs:  ${counts.cloudinary}`);
  console.log(`  Other CDN/https:  ${counts['other-cdn']}`);
  console.log(`  Local paths:      ${counts['local-path']}\n`);

  for (const [bucket, urls] of Object.entries(buckets)) {
    if (urls.length) {
      console.log(`Sample ${bucket} URLs:`);
      urls.forEach((u) => console.log(`  ${u}`));
      console.log('');
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
