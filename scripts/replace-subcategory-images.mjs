/**
 * Replace product images for an entire subcategory with a shared set of
 * newly-uploaded Cloudinary images.
 *
 * Use case: e.g. every "Black Diamonds" product should show the same 4
 * photos, instead of the stale/legacy per-row images that came in from the
 * old CSV import.
 *
 * USAGE
 * ─────
 *   1) Dry run first (default — makes NO changes):
 *      node scripts/replace-subcategory-images.mjs \
 *        --subcategory "Black Diamonds" \
 *        --images ./local-images/black-diamonds
 *
 *   2) Once the dry run output looks right, actually apply it:
 *      node scripts/replace-subcategory-images.mjs \
 *        --subcategory "Black Diamonds" \
 *        --images ./local-images/black-diamonds \
 *        --apply
 *
 * FLAGS
 * ─────
 *   --subcategory "<name>"   Required. Subcategory name (case-insensitive,
 *                            matches against name or slug).
 *   --category "<name>"      Optional. Narrows the subcategory lookup if the
 *                            same subcategory name exists under multiple
 *                            categories.
 *   --images <folder>        Required. Local folder containing the images to
 *                            upload (jpg/jpeg/png/webp/avif). All files in
 *                            the folder are uploaded, sorted by filename.
 *   --apply                  Actually upload + write to the DB. Without this
 *                            flag the script only previews what it WOULD do.
 *   --folder <cloudinary-folder>
 *                            Optional. Cloudinary folder to upload into.
 *                            Defaults to `products/<subcategory-slug>`.
 *
 * REQUIRES in .env / .env.local:
 *   MONGODB_URI
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';

// Load .env.local first (Next.js convention), then fall back to .env
config({ path: '.env.local' });
config();

// ── CLI args ────────────────────────────────────────────────────────────────
function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const subcategoryName = getArg('subcategory');
const categoryName = getArg('category');
const imagesDir = getArg('images');
const apply = Boolean(getArg('apply', false));
const cloudinaryFolderArg = getArg('folder');

if (!subcategoryName || !imagesDir) {
  console.error(
    'Usage: node scripts/replace-subcategory-images.mjs --subcategory "Black Diamonds" --images ./local-images/black-diamonds [--category "Diamonds"] [--apply] [--folder products/black-diamonds]'
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

// ── Minimal inline schemas (same pattern as scripts/seed.mjs) ─────────────────
const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  category: mongoose.Schema.Types.ObjectId,
});
const ProductSchema = new mongoose.Schema(
  {
    name: String,
    category: mongoose.Schema.Types.ObjectId,
    subcategory: mongoose.Schema.Types.ObjectId,
    images: [String],
  },
  { strict: false } // don't fight the real schema's enums/validators — we only touch `images`
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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
  // ── 1. Read local image files ──────────────────────────────────────────────
  const resolvedDir = path.resolve(process.cwd(), imagesDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    console.error(`❌ Folder not found: ${resolvedDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(resolvedDir)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`❌ No image files (${[...IMAGE_EXTENSIONS].join(', ')}) found in ${resolvedDir}`);
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} local image(s) in ${resolvedDir}:`);
  files.forEach((f) => console.log(`   - ${f}`));

  // ── 2. Connect to Mongo ──────────────────────────────────────────────────────
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ── 3. Resolve the subcategory ───────────────────────────────────────────────
  const nameRegex = new RegExp(`^${subcategoryName.trim()}$`, 'i');
  const slugCandidate = slugify(subcategoryName);

  let subcategoryQuery = { $or: [{ name: nameRegex }, { slug: slugCandidate }] };

  if (categoryName) {
    const cat = await Category.findOne({
      $or: [{ name: new RegExp(`^${categoryName.trim()}$`, 'i') }, { slug: slugify(categoryName) }],
    }).lean();
    if (!cat) {
      console.error(`❌ Category not found: "${categoryName}"`);
      process.exit(1);
    }
    subcategoryQuery = { ...subcategoryQuery, category: cat._id };
  }

  const matchingSubcategories = await Subcategory.find(subcategoryQuery).lean();

  if (matchingSubcategories.length === 0) {
    console.error(`❌ No subcategory found matching "${subcategoryName}"${categoryName ? ` under category "${categoryName}"` : ''}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (matchingSubcategories.length > 1) {
    console.error(
      `❌ Found ${matchingSubcategories.length} subcategories matching "${subcategoryName}" — pass --category to disambiguate:`
    );
    for (const s of matchingSubcategories) {
      const cat = await Category.findById(s.category).lean();
      console.error(`   - "${s.name}" (slug: ${s.slug}) under category "${cat?.name ?? s.category}"`);
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  const subcategory = matchingSubcategories[0];
  console.log(`✅ Matched subcategory: "${subcategory.name}" (slug: ${subcategory.slug}, _id: ${subcategory._id})`);

  // ── 4. Find affected products ────────────────────────────────────────────────
  const matchQuery = { subcategory: subcategory._id };
  const productCount = await Product.countDocuments(matchQuery);

  if (productCount === 0) {
    console.error('❌ No products found under this subcategory. Nothing to do.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const sampleProducts = await Product.find(matchQuery).select('name images').limit(5).lean();

  console.log(`\n📦 ${productCount} product(s) currently in "${subcategory.name}"`);
  console.log('   Sample of current products (name — current image count):');
  for (const p of sampleProducts) {
    console.log(`   - ${p.name}  (${(p.images ?? []).length} image(s))`);
  }

  const cloudinaryFolder = cloudinaryFolderArg || `products/${subcategory.slug}`;

  if (!apply) {
    console.log('\n🧪 DRY RUN — no uploads and no database writes were made.');
    console.log(`   Would upload ${files.length} image(s) to Cloudinary folder "${cloudinaryFolder}"`);
    console.log(`   Would then set images: [<4 new urls>] on all ${productCount} product(s) in "${subcategory.name}"`);
    console.log('\n   Re-run with --apply to actually do this.');
    await mongoose.disconnect();
    return;
  }

  // ── 5. Upload images to Cloudinary ───────────────────────────────────────────
  console.log(`\n⬆️  Uploading ${files.length} image(s) to Cloudinary folder "${cloudinaryFolder}"...`);
  const uploadedUrls = [];
  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const buffer = fs.readFileSync(filePath);
    const { secure_url, public_id } = await uploadBuffer(buffer, file, cloudinaryFolder);
    console.log(`   ✅ ${file} -> ${secure_url}`);
    uploadedUrls.push(secure_url);
  }

  // ── 6. Update all matching products ──────────────────────────────────────────
  console.log(`\n💾 Updating ${productCount} product(s)...`);
  const result = await Product.updateMany(matchQuery, { $set: { images: uploadedUrls } });
  console.log(`✅ Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  console.log('\n🎉 Done. New shared image set:');
  uploadedUrls.forEach((u) => console.log(`   - ${u}`));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
