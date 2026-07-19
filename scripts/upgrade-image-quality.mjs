/**
 * Upgrades EXISTING Cloudinary image URLs already stored on products by
 * injecting a delivery transformation segment into the URL — no re-upload,
 * no Cloudinary API calls, no new images. Cloudinary applies the
 * transformation on-the-fly when the URL is requested, and caches the
 * result at their edge.
 *
 * This only touches URLs that are already on res.cloudinary.com. Any
 * legacy/non-Cloudinary URLs (e.g. old CSV-import paths that were never
 * replaced) are left untouched.
 *
 * WHAT IT ADDS (default):
 *   f_auto        -> Cloudinary picks the best format per browser (WebP/AVIF
 *                     where supported, falls back to PNG/JPG)
 *   q_auto:best    -> Cloudinary's highest-quality auto compression tier
 *
 * OPTIONAL ADD-ONS:
 *   --width 1200   -> caps delivered width at 1200px (adds c_limit,w_1200)
 *                     so you're not shipping a 6000px original to a card
 *                     that displays at 400px, without ever upscaling past
 *                     the original's real resolution.
 *   --sharpen      -> adds a mild sharpen (e_sharpen:60), sometimes helps
 *                     transparent product cutouts read a bit crisper.
 *
 * The script is idempotent — re-running it skips any URL that already has
 * "q_auto" in its transform segment, so it's safe to run multiple times as
 * you add more products.
 *
 * USAGE
 * ─────
 *   Dry run across the WHOLE catalog (default, no writes):
 *     node scripts/upgrade-image-quality.mjs
 *
 *   Dry run scoped to one subcategory first (recommended for a first look):
 *     node scripts/upgrade-image-quality.mjs --subcategory "Black Diamonds"
 *
 *   Apply across everything:
 *     node scripts/upgrade-image-quality.mjs --apply
 *
 *   Apply with a width cap and sharpening:
 *     node scripts/upgrade-image-quality.mjs --width 1200 --sharpen --apply
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const subcategoryName = getArg('subcategory');
const widthArg = getArg('width');
const sharpen = Boolean(getArg('sharpen', false));
const apply = Boolean(getArg('apply', false));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const SubcategorySchema = new mongoose.Schema({ name: String, slug: String });
const ProductSchema = new mongoose.Schema(
  { name: String, subcategory: mongoose.Schema.Types.ObjectId, images: [String] },
  { strict: false }
);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// ── Build the transform string ─────────────────────────────────────────────
const parts = [];
if (widthArg) {
  const w = parseInt(widthArg, 10);
  if (Number.isNaN(w) || w < 50) {
    console.error(`❌ Invalid --width "${widthArg}"`);
    process.exit(1);
  }
  parts.push('c_limit', `w_${w}`);
}
parts.push('f_auto', 'q_auto:best');
if (sharpen) parts.push('e_sharpen:60');
const TRANSFORM = parts.join(',');

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');
}

function alreadyUpgraded(url) {
  // Cheap check: our transform segment (or any prior q_auto) is already
  // present right after /upload/ — don't stack transforms on re-runs.
  const match = url.match(/\/upload\/([^/]+)\//);
  return !!match && match[1].includes('q_auto');
}

function upgradeUrl(url) {
  if (!isCloudinaryUrl(url) || alreadyUpgraded(url)) return url;
  return url.replace('/upload/', `/upload/${TRANSFORM}/`);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(`\nTransform to apply: ${TRANSFORM}\n`);

  const matchQuery = {};
  if (subcategoryName) {
    const sub = await Subcategory.findOne({
      $or: [
        { slug: subcategoryName.toLowerCase() },
        { name: new RegExp(`^${subcategoryName.trim()}$`, 'i') },
      ],
    }).lean();
    if (!sub) {
      console.error(`❌ No subcategory found matching "${subcategoryName}"`);
      await mongoose.disconnect();
      process.exit(1);
    }
    matchQuery.subcategory = sub._id;
    console.log(`Scoped to subcategory: "${sub.name}"\n`);
  } else {
    console.log('Scope: ALL products in the catalog\n');
  }

  const cursor = Product.find(matchQuery).select('name images').cursor();

  let scanned = 0;
  let cloudinaryImages = 0;
  let alreadyDone = 0;
  let toUpgrade = 0;
  let nonCloudinary = 0;
  let productsWithChanges = 0;
  const samples = [];

  const BATCH_SIZE = 500;
  let bulkOps = [];
  let batchesWritten = 0;

  for await (const product of cursor) {
    scanned++;
    let changed = false;
    const newImages = (product.images || []).map((url) => {
      if (!isCloudinaryUrl(url)) {
        nonCloudinary++;
        return url;
      }
      cloudinaryImages++;
      if (alreadyUpgraded(url)) {
        alreadyDone++;
        return url;
      }
      toUpgrade++;
      changed = true;
      const upgraded = upgradeUrl(url);
      if (samples.length < 3) samples.push({ before: url, after: upgraded });
      return upgraded;
    });

    if (changed) {
      productsWithChanges++;
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

  console.log(`\n📊 Scanned ${scanned} product(s)`);
  console.log(`   Cloudinary image URLs found: ${cloudinaryImages}`);
  console.log(`   Already upgraded (skipped):  ${alreadyDone}`);
  console.log(`   Non-Cloudinary (left as-is): ${nonCloudinary}`);
  console.log(`   ${apply ? 'Upgraded' : 'Would upgrade'}: ${toUpgrade} image URL(s) across ${productsWithChanges} product(s)`);

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
    console.log('🎉 Done. No Cloudinary uploads were made — only URL strings were rewritten.');
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
