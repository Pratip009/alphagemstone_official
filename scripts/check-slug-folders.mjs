/**
 * Checks that every subfolder under --base-dir matches a real subcategory
 * slug in the DB — WITHOUT requiring any images to be in the folders yet,
 * and WITHOUT touching Cloudinary or writing anything. Pure verification.
 *
 * Run this right after creating your local-images/<slug> folders, before
 * you spend time downloading images into them, to catch typos/renames.
 *
 * USAGE:
 *   node scripts/check-slug-folders.mjs --base-dir ./local-images
 */

import fs from 'node:fs';
import path from 'node:path';
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

const baseDir = getArg('base-dir');
if (!baseDir) {
  console.error('Usage: node scripts/check-slug-folders.mjs --base-dir ./local-images');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const SubcategorySchema = new mongoose.Schema({ name: String, slug: String });
const ProductSchema = new mongoose.Schema(
  { subcategory: mongoose.Schema.Types.ObjectId },
  { strict: false }
);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

async function main() {
  const resolvedBase = path.resolve(process.cwd(), baseDir);
  if (!fs.existsSync(resolvedBase) || !fs.statSync(resolvedBase).isDirectory()) {
    console.error(`❌ Base folder not found: ${resolvedBase}`);
    process.exit(1);
  }

  const subfolders = fs
    .readdirSync(resolvedBase)
    .filter((f) => fs.statSync(path.join(resolvedBase, f)).isDirectory())
    .sort();

  if (subfolders.length === 0) {
    console.error(`❌ No subfolders found in ${resolvedBase}`);
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB`);
  console.log(`📁 Checking ${subfolders.length} subfolder(s) in ${resolvedBase}\n`);

  let matched = 0;
  let unmatched = 0;

  for (const folderName of subfolders) {
    const folderPath = path.join(resolvedBase, folderName);
    const imageCount = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())).length;

    const subcategory = await Subcategory.findOne({
      $or: [{ slug: folderName.toLowerCase() }, { name: new RegExp(`^${folderName}$`, 'i') }],
    }).lean();

    if (!subcategory) {
      console.log(`❌ ${folderName.padEnd(30)} -> NO MATCHING SUBCATEGORY (check for typo)`);
      unmatched++;
      continue;
    }

    const productCount = await Product.countDocuments({ subcategory: subcategory._id });
    const imgStatus = imageCount === 0 ? 'no images yet' : `${imageCount} image(s)`;
    console.log(
      `✅ ${folderName.padEnd(30)} -> "${subcategory.name}" | ${productCount} product(s) | ${imgStatus}`
    );
    matched++;
  }

  console.log(`\n${matched} matched, ${unmatched} unmatched.`);
  if (unmatched > 0) {
    console.log('Fix the unmatched folder names (rename to the exact slug from subcategory-report.csv) and re-run.');
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
