/**
 * Takes the manifest produced by scripts/download-upscaled-images.mjs and
 * swaps every old (on-the-fly-upscaled) Cloudinary URL for the new, already-
 * baked static URL across all products in MongoDB.
 *
 * This is the step that actually removes the need for the runtime aiUpscale
 * feature: after this runs, product.images[] point straight at plain,
 * pre-processed Cloudinary assets — no e_upscale, no cold-cache AI pass, no
 * client-side dimension probe needed before deciding whether to request one.
 *
 * Safe by default: dry run unless you pass --apply, same pattern as
 * scripts/upgrade-image-quality.mjs.
 *
 * USAGE
 * ─────
 *   Dry run (no writes, just shows what would change):
 *     node scripts/apply-image-manifest.mjs --manifest downloads/upscaled-images/manifest.json
 *
 *   Apply for real:
 *     node scripts/apply-image-manifest.mjs --manifest downloads/upscaled-images/manifest.json --apply
 *
 * Requires MONGODB_URI in .env.local or .env.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import fs from 'fs';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const manifestPath = getArg('manifest');
const apply = Boolean(getArg('apply', false));

if (!manifestPath) {
  console.error('❌ Pass --manifest <path-to-manifest.json> (produced by download-upscaled-images.mjs)');
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const ProductSchema = new mongoose.Schema(
  { name: String, images: [String] },
  { strict: false }
);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// Extracts the Cloudinary public_id out of ANY Cloudinary delivery URL,
// regardless of what transformation string (if any) is baked into the path.
// e.g. both of these resolve to public_id "alphaimports-legacy/abc123":
//   .../image/upload/v1782839038/alphaimports-legacy/abc123.jpg
//   .../image/upload/f_auto,q_auto:best/v1782839038/alphaimports-legacy/abc123.jpg
//   .../image/upload/e_upscale/w_2200,c_scale,q_auto:best/v123/alphaimports-legacy/abc123.jpg
function extractPublicId(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:[^/]+\/)*v\d+\/(.+)\.[^./?]+(?:\?.*)?$/);
  return match ? match[1] : null;
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Only rows that actually succeeded and have a new_url are usable.
  const usable = rows.filter((r) => r.status === 'ok' && r.new_url);
  const skippedFailed = rows.length - usable.length;

  if (skippedFailed > 0) {
    console.log(`⚠️  Skipping ${skippedFailed} manifest row(s) without a successful new_url (failed downloads/uploads).`);
  }
  if (usable.length === 0) {
    console.log('Nothing usable in the manifest — nothing to do.');
    return;
  }

  // public_id -> new_url lookup (NOT old_url -> new_url — the DB may store
  // URLs with a transformation baked into the path, e.g. "f_auto,q_auto:best/",
  // which the plain Admin-API secure_url in the manifest won't have. Matching
  // on public_id is robust to that.)
  const idMap = new Map(usable.map((r) => [r.old_public_id, r.new_url]));

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(`Loaded ${idMap.size} old->new mapping(s) from manifest (matching by public_id)\n`);

  // Can't pre-filter with $in on exact URLs anymore since stored URLs vary by
  // whatever transformation happens to be baked in — scan every product that
  // has at least one image instead.
  const cursor = Product.find({ 'images.0': { $exists: true } })
    .select('name images')
    .cursor();

  let scanned = 0;
  let productsChanged = 0;
  let imagesReplaced = 0;
  let bulkOps = [];
  let batchesWritten = 0;
  const BATCH_SIZE = 500;
  const samples = [];

  for await (const product of cursor) {
    scanned++;
    let changed = false;
    const newImages = (product.images || []).map((url) => {
      const publicId = extractPublicId(url);
      const replacement = publicId ? idMap.get(publicId) : undefined;
      if (!replacement) return url;
      changed = true;
      imagesReplaced++;
      if (samples.length < 5) samples.push({ before: url, after: replacement });
      return replacement;
    });

    if (changed) {
      productsChanged++;
      if (apply) {
        bulkOps.push({
          updateOne: { filter: { _id: product._id }, update: { $set: { images: newImages } } },
        });
        if (bulkOps.length >= BATCH_SIZE) {
          await Product.bulkWrite(bulkOps, { ordered: false });
          batchesWritten += bulkOps.length;
          process.stdout.write(`\r💾 Updated ${batchesWritten} product(s)...`);
          bulkOps = [];
        }
      }
    }
  }

  if (apply && bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
    batchesWritten += bulkOps.length;
  }
  if (apply) console.log(`\r💾 Updated ${batchesWritten} product(s).           `);

  console.log(`\n📊 Scanned ${scanned} product(s) referencing at least one mapped image`);
  console.log(`   Products with a change: ${productsChanged}`);
  console.log(`   Image URLs ${apply ? 'replaced' : 'that would be replaced'}: ${imagesReplaced}`);

  if (samples.length > 0) {
    console.log(`\nSample before -> after:`);
    for (const s of samples) {
      console.log(`   before: ${s.before}`);
      console.log(`   after:  ${s.after}\n`);
    }
  }

  if (!apply) {
    console.log('🧪 DRY RUN — no database writes were made. Re-run with --apply to execute.');
  } else {
    console.log('🎉 Done. Products now point at the pre-baked static images.');
    console.log('Next: remove the now-unnecessary `aiUpscale: true` calls in');
    console.log('ProductCard.tsx, Specialsmarquee.tsx, ProductGallery.tsx and the');
    console.log('related-products block in app/(shop)/products/[id]/page.tsx.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
