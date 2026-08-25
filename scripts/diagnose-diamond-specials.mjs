/**
 * Diagnoses the "Diamond Specials shows 15 instead of 672" discrepancy.
 * Run against the LIVE database this app actually reads from.
 *
 * USAGE:
 *   node diagnose-diamond-specials.mjs
 * (expects MONGODB_URI in .env.local or .env, same as the other scripts/*.mjs)
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

const Product = mongoose.models.Product || mongoose.model(
  'Product',
  new mongoose.Schema({}, { strict: false })
);
const Subcategory = mongoose.models.Subcategory || mongoose.model(
  'Subcategory',
  new mongoose.Schema({}, { strict: false })
);
const Category = mongoose.models.Category || mongoose.model(
  'Category',
  new mongoose.Schema({}, { strict: false })
);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const specialsCat = await Category.findOne({ slug: 'specials' }).lean();
  const diamondSpecialsSub = await Subcategory.findOne({ slug: 'diamond-specials' }).lean();

  console.log('Category "specials" doc:', specialsCat?._id?.toString() ?? 'NOT FOUND');
  console.log('Subcategory "diamond-specials" doc:', diamondSpecialsSub?._id?.toString() ?? 'NOT FOUND');
  console.log();

  if (diamondSpecialsSub) {
    const byPrimaryRefAll = await Product.countDocuments({ subcategory: diamondSpecialsSub._id });
    const byPrimaryRefActive = await Product.countDocuments({ subcategory: diamondSpecialsSub._id, isActive: true });
    console.log(`Products with PRIMARY subcategory = Diamond Specials (any isActive): ${byPrimaryRefAll}`);
    console.log(`  ...of those, isActive: true: ${byPrimaryRefActive}`);
  }

  const byLegacyIdAll = await Product.countDocuments({ legacyCategoryId: 203 });
  const byLegacyIdActive = await Product.countDocuments({ legacyCategoryId: 203, isActive: true });
  console.log(`\nProducts with legacyCategoryId containing 203 (any isActive): ${byLegacyIdAll}`);
  console.log(`  ...of those, isActive: true: ${byLegacyIdActive}`);

  const noLegacyId = await Product.countDocuments({
    subcategory: diamondSpecialsSub?._id,
    $or: [{ legacyCategoryId: { $exists: false } }, { legacyCategoryId: { $size: 0 } }],
  });
  console.log(`\nDiamond Specials products with NO legacyCategoryId at all: ${noLegacyId}`);

  // What the actual app query returns right now (mirrors buildProductFilterQuery's
  // specialsLegacyId branch)
  const liveQuery = {
    isActive: true,
    $or: [
      { legacyCategoryId: 203 },
      ...(specialsCat && diamondSpecialsSub
        ? [{ category: specialsCat._id, subcategory: diamondSpecialsSub._id }]
        : []),
    ],
  };
  const liveCount = await Product.countDocuments(liveQuery);
  console.log(`\n➡️  What the live /products page query actually returns right now: ${liveCount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
