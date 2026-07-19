/**
 * Batch version of replace-subcategory-images.mjs.
 *
 * Point it at ONE parent folder that contains a subfolder per subcategory,
 * named by the subcategory SLUG (see scripts/list-subcategories.mjs for the
 * exact slug to use for each one). It processes every subfolder in one run.
 *
 * FOLDER LAYOUT EXPECTED:
 *   local-images/
 *     black-diamonds/
 *       img1.png
 *       img2.png
 *       img3.png
 *       img4.png
 *     blue-sapphire/
 *       img1.jpg
 *       ...
 *     ruby/
 *       ...
 *
 * USAGE
 * ─────
 *   Dry run (default, no writes, no uploads):
 *     node scripts/replace-subcategory-images-batch.mjs --base-dir ./local-images
 *
 *   Apply for real:
 *     node scripts/replace-subcategory-images-batch.mjs --base-dir ./local-images --apply
 *
 *   Process only specific subfolders (comma-separated slugs), skip the rest:
 *     node scripts/replace-subcategory-images-batch.mjs --base-dir ./local-images --only black-diamonds,ruby --apply
 *
 * Any subfolder whose name doesn't match an existing subcategory slug is
 * reported and skipped — nothing is guessed or auto-created.
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const baseDir = getArg('base-dir');
const apply = Boolean(getArg('apply', false));
const onlyArg = getArg('only');
const onlySlugs = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim().toLowerCase())) : null;

if (!baseDir) {
  console.error(
    'Usage: node scripts/replace-subcategory-images-batch.mjs --base-dir ./local-images [--only slug1,slug2] [--apply]'
  );
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not all set');
  process.exit(1);
}
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const SubcategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  category: mongoose.Schema.Types.ObjectId,
});
const ProductSchema = new mongoose.Schema(
  { subcategory: mongoose.Schema.Types.ObjectId, images: [String] },
  { strict: false }
);

const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function uploadBuffer(buffer, filename, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        overwrite: false,
        resource_type: 'image',
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function main() {
  const resolvedBase = path.resolve(process.cwd(), baseDir);
  if (!fs.existsSync(resolvedBase) || !fs.statSync(resolvedBase).isDirectory()) {
    console.error(`❌ Base folder not found: ${resolvedBase}`);
    process.exit(1);
  }

  const subfolders = fs
    .readdirSync(resolvedBase)
    .filter((f) => fs.statSync(path.join(resolvedBase, f)).isDirectory())
    .filter((f) => (onlySlugs ? onlySlugs.has(f.toLowerCase()) : true))
    .sort();

  if (subfolders.length === 0) {
    console.error(`❌ No subfolders found in ${resolvedBase}`);
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB`);
  console.log(`📁 Found ${subfolders.length} subfolder(s) to process:\n   ${subfolders.join(', ')}\n`);

  const plan = [];
  const skipped = [];

  for (const folderName of subfolders) {
    const folderPath = path.join(resolvedBase, folderName);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort();

    if (files.length === 0) {
      skipped.push({ folderName, reason: 'no image files found' });
      continue;
    }

    const subcategory = await Subcategory.findOne({
      $or: [{ slug: folderName.toLowerCase() }, { name: new RegExp(`^${folderName}$`, 'i') }],
    }).lean();

    if (!subcategory) {
      skipped.push({ folderName, reason: 'no matching subcategory (check slug against list-subcategories.mjs output)' });
      continue;
    }

    const productCount = await Product.countDocuments({ subcategory: subcategory._id });
    if (productCount === 0) {
      skipped.push({ folderName, reason: `subcategory "${subcategory.name}" matched but has 0 products` });
      continue;
    }

    plan.push({ folderName, folderPath, files, subcategory, productCount });
  }

  console.log('PLAN:');
  console.log('-'.repeat(90));
  for (const p of plan) {
    console.log(
      `✅ ${p.folderName.padEnd(25)} -> "${p.subcategory.name}" | ${p.files.length} image(s) | ${p.productCount} product(s)`
    );
  }
  if (skipped.length > 0) {
    console.log('\nSKIPPED:');
    for (const s of skipped) {
      console.log(`⚠️  ${s.folderName.padEnd(25)} -> ${s.reason}`);
    }
  }

  const totalProducts = plan.reduce((sum, p) => sum + p.productCount, 0);
  console.log(`\nTOTAL: ${plan.length} subcategories, ${totalProducts} products would be updated.`);

  if (!apply) {
    console.log('\n🧪 DRY RUN — no uploads and no database writes were made. Re-run with --apply to execute.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n🚀 Applying...\n');
  const results = [];
  for (const p of plan) {
    console.log(`--- ${p.subcategory.name} (${p.folderName}) ---`);
    const cloudinaryFolder = `products/${p.subcategory.slug}`;
    const uploadedUrls = [];
    for (const file of p.files) {
      const buffer = fs.readFileSync(path.join(p.folderPath, file));
      const { secure_url } = await uploadBuffer(buffer, file, cloudinaryFolder);
      console.log(`   ✅ uploaded ${file}`);
      uploadedUrls.push(secure_url);
    }
    const result = await Product.updateMany(
      { subcategory: p.subcategory._id },
      { $set: { images: uploadedUrls } }
    );
    console.log(`   💾 updated ${result.modifiedCount}/${p.productCount} product(s)\n`);
    results.push({ subcategory: p.subcategory.name, modified: result.modifiedCount });
  }

  console.log('🎉 Batch complete:');
  for (const r of results) {
    console.log(`   - ${r.subcategory}: ${r.modified} product(s) updated`);
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
