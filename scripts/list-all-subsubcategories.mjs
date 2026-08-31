/**
 * Read-only: lists EVERY SubSubcategory in the database, grouped by its
 * parent Category > Subcategory, and shows whether each one already has
 * an image set.
 *
 * This is the "before you start uploading" inventory — run it once to see
 * exactly how many sub-subcategories exist system-wide and how many still
 * fall back to the generic stock photo on the storefront.
 *
 * Does NOT write anything to the DB.
 *
 * USAGE:
 *   node scripts/list-all-subsubcategories.mjs
 *   node scripts/list-all-subsubcategories.mjs --missing-only   # only print rows without an image
 *   node scripts/list-all-subsubcategories.mjs --category "Precious Gems"
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MISSING_ONLY   = process.argv.includes('--missing-only');
const CATEGORY_FILTER = argValue('--category', null);

// ── Minimal inline schemas (read-only — mirrors the real models' shape) ────
const CategorySchema = new mongoose.Schema({
  name: String, slug: String, isActive: Boolean, sortOrder: Number,
});
const SubcategorySchema = new mongoose.Schema({
  name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: Boolean,
});
const SubSubcategorySchema = new mongoose.Schema(
  {
    name: String, slug: String,
    subcategory: mongoose.Schema.Types.ObjectId,
    category: mongoose.Schema.Types.ObjectId,
    imageUrl: String,
    imagePublicId: String,
    sortOrder: Number,
    isActive: Boolean,
  },
  { timestamps: true }
);

const Category       = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory    = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const SubSubcategory = mongoose.models.SubSubcategory || mongoose.model('SubSubcategory', SubSubcategorySchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB (read-only)\n`);

  const catFilter = {};
  if (CATEGORY_FILTER) catFilter.name = new RegExp(`^${CATEGORY_FILTER}$`, 'i');

  const categories = await Category.find(catFilter).sort({ sortOrder: 1, name: 1 }).lean();
  if (categories.length === 0) {
    console.log(CATEGORY_FILTER ? `⚠️  No category matching "${CATEGORY_FILTER}".` : '⚠️  No categories found.');
    await mongoose.disconnect();
    return;
  }

  const subs = await Subcategory.find({ category: { $in: categories.map((c) => c._id) } })
    .sort({ name: 1 })
    .lean();

  const allSubsubs = await SubSubcategory.find({ subcategory: { $in: subs.map((s) => s._id) } })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const subsBySubcat = new Map();
  for (const ss of allSubsubs) {
    const key = String(ss.subcategory);
    if (!subsBySubcat.has(key)) subsBySubcat.set(key, []);
    subsBySubcat.get(key).push(ss);
  }

  let totalCount = 0;
  let missingCount = 0;
  const missingList = [];

  for (const cat of categories) {
    const catSubs = subs.filter((s) => String(s.category) === String(cat._id));
    if (catSubs.length === 0) continue;

    // only print the category header if it actually has sub-subcategories somewhere under it
    const hasAnySubsub = catSubs.some((s) => (subsBySubcat.get(String(s._id)) || []).length > 0);
    if (!hasAnySubsub) continue;

    console.log(`\n📁 ${cat.name}`);

    for (const sub of catSubs) {
      const items = subsBySubcat.get(String(sub._id)) || [];
      if (items.length === 0) continue;

      console.log(`   └─ ${sub.name}`);

      for (const it of items) {
        totalCount++;
        const hasImage = !!it.imageUrl;
        if (!hasImage) {
          missingCount++;
          missingList.push(`${cat.name} → ${sub.name} → ${it.name}`);
        }
        if (MISSING_ONLY && hasImage) continue;

        const status = hasImage ? '✓ has image' : '✗ no image (static fallback)';
        const activeTag = it.isActive === false ? '  [inactive]' : '';
        console.log(`        • ${it.name.padEnd(28)} ${status}${activeTag}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Total sub-subcategories: ${totalCount}`);
  console.log(`With image:              ${totalCount - missingCount}`);
  console.log(`Missing image:           ${missingCount}`);

  if (missingCount > 0 && !MISSING_ONLY) {
    console.log(`\nRun with --missing-only to print just the ones needing an image.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
