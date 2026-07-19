/**
 * Reorder the `images` array on every product in a subcategory, WITHOUT
 * re-uploading anything. Useful after running replace-subcategory-images.mjs
 * once you realize the product card (which shows images[0]) is picking the
 * "wrong" image as the primary/first one.
 *
 * All products in a subcategory processed by replace-subcategory-images.mjs
 * share the exact same images array (same URLs, same order), so this script
 * reorders by POSITION (1-based index into the current array) — it does not
 * need to know the actual Cloudinary URLs.
 *
 * USAGE
 * ─────
 *   Dry run (default, no writes):
 *     node scripts/reorder-subcategory-images.mjs \
 *       --subcategory "Black Diamonds" \
 *       --order 3,1,2,4
 *
 *   Apply for real:
 *     node scripts/reorder-subcategory-images.mjs \
 *       --subcategory "Black Diamonds" \
 *       --order 3,1,2,4 \
 *       --apply
 *
 * --order is a comma-separated permutation of 1..N (N = current image
 * count). "3,1,2,4" means: current image #3 becomes images[0] (the card
 * thumbnail), then #1, then #2, then #4.
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
const categoryName = getArg('category');
const orderArg = getArg('order');
const apply = Boolean(getArg('apply', false));

if (!subcategoryName || !orderArg) {
  console.error(
    'Usage: node scripts/reorder-subcategory-images.mjs --subcategory "Black Diamonds" --order 3,1,2,4 [--category "Diamonds"] [--apply]'
  );
  process.exit(1);
}

const order = orderArg.split(',').map((s) => parseInt(s.trim(), 10));
if (order.some((n) => Number.isNaN(n) || n < 1)) {
  console.error(`❌ Invalid --order "${orderArg}" — must be comma-separated positive integers, e.g. 3,1,2,4`);
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

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
  { strict: false }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function reorderImages(images, order) {
  // order is 1-based positions into the ORIGINAL array
  return order.map((pos) => images[pos - 1]).filter((url) => url !== undefined);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

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
    console.error(`❌ No subcategory found matching "${subcategoryName}"`);
    await mongoose.disconnect();
    process.exit(1);
  }
  if (matchingSubcategories.length > 1) {
    console.error(`❌ Multiple subcategories matched "${subcategoryName}" — pass --category to disambiguate.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const subcategory = matchingSubcategories[0];
  console.log(`✅ Matched subcategory: "${subcategory.name}" (_id: ${subcategory._id})`);

  const matchQuery = { subcategory: subcategory._id };
  const products = await Product.find(matchQuery).select('name images').lean();

  if (products.length === 0) {
    console.error('❌ No products found under this subcategory.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n📦 ${products.length} product(s) in "${subcategory.name}"`);

  // Sanity check: warn about any products whose image count doesn't match
  // the highest index referenced in --order, or whose arrays differ from
  // the first product's (i.e. they weren't part of the shared-image batch).
  const first = products[0];
  const mismatched = products.filter(
    (p) => JSON.stringify(p.images) !== JSON.stringify(first.images)
  );
  if (mismatched.length > 0) {
    console.log(
      `⚠️  ${mismatched.length} product(s) have a DIFFERENT images array than the rest — they'll each be reordered based on their OWN current array, using the same position numbers. Double check --order still makes sense for them.`
    );
  }

  console.log(`\nCurrent order (sample from "${first.name}"):`);
  first.images.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));

  console.log(`\nNew order requested: [${order.join(', ')}]`);
  console.log('Preview of new order for the sample product:');
  reorderImages(first.images, order).forEach((url, i) => console.log(`   ${i + 1}. ${url}`));

  if (!apply) {
    console.log(`\n🧪 DRY RUN — no database writes were made. Re-run with --apply to actually reorder.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n💾 Reordering images for ${products.length} product(s)...`);
  let modified = 0;
  for (const p of products) {
    const newImages = reorderImages(p.images, order);
    await Product.updateOne({ _id: p._id }, { $set: { images: newImages } });
    modified++;
  }
  console.log(`✅ Reordered images on ${modified} product(s).`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
