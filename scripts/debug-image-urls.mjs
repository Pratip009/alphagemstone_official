/**
 * READ-ONLY diagnostic — makes no changes to anything.
 *
 * apply-image-manifest.mjs found 0 matching products even though the
 * manifest has 4,110 URL mappings. This prints:
 *   1. A handful of raw `images[]` values straight from MongoDB
 *   2. Every distinct Cloudinary cloud_name / domain found across all
 *      product images
 *   3. What CLOUDINARY_CLOUD_NAME your .env is currently configured with
 *      (the account download-upscaled-images.mjs pulled from)
 *
 * so we can see exactly why the strings don't match.
 *
 * USAGE
 *   node scripts/debug-image-urls.mjs
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set');
  process.exit(1);
}

const ProductSchema = new mongoose.Schema({ name: String, images: [String] }, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  console.log(`.env CLOUDINARY_CLOUD_NAME = "${process.env.CLOUDINARY_CLOUD_NAME || '(not set)'}"`);
  console.log(`.env NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '(not set)'}"\n`);

  const samples = await Product.find({ 'images.0': { $exists: true } })
    .select('name images legacyProductId')
    .limit(10)
    .lean();

  console.log(`── Sample of ${samples.length} product(s) with images ──`);
  for (const p of samples) {
    console.log(`\n${p.name} (legacyProductId: ${p.legacyProductId ?? 'n/a'})`);
    for (const img of p.images) {
      console.log(`   ${img}`);
    }
  }

  console.log(`\n\n── Scanning ALL products for distinct image URL hosts/domains ──`);
  const all = await Product.find({ 'images.0': { $exists: true } }).select('images').lean();
  const hostCounts = new Map();
  let totalImages = 0;
  for (const p of all) {
    for (const img of p.images || []) {
      totalImages++;
      let key;
      try {
        const u = new URL(img);
        // Cloudinary URLs look like /<cloud_name>/image/upload/... — grab host + cloud_name
        const parts = u.pathname.split('/').filter(Boolean);
        key = u.host + (u.host.includes('cloudinary') ? '/' + parts[0] : '');
      } catch {
        key = `(unparseable: ${String(img).slice(0, 60)})`;
      }
      hostCounts.set(key, (hostCounts.get(key) || 0) + 1);
    }
  }

  console.log(`Scanned ${all.length} product(s), ${totalImages} total image URL(s).\n`);
  console.log('Host/cloud_name breakdown:');
  for (const [key, count] of [...hostCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${count.toString().padStart(6)}  ${key}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
