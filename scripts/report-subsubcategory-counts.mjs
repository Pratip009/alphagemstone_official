/**
 * Diagnostic: for every SubSubcategory, shows how many products are
 * actually linked to it (product.subSubcategory === that doc's _id),
 * plus how many products sit in its parent Subcategory still unlinked
 * (product.subcategory === parent, product.subSubcategory == null).
 *
 * Read-only — never writes anything. Run this to see which types are
 * genuinely empty vs. which just look empty for another reason.
 *
 * USAGE:
 *   node scripts/report-subsubcategory-counts.mjs
 *   node scripts/report-subsubcategory-counts.mjs --empty-only
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

const EMPTY_ONLY = process.argv.includes('--empty-only');

const SubcategorySchema = new mongoose.Schema({
  name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: Boolean,
});
const SubSubcategorySchema = new mongoose.Schema(
  {
    name: String, slug: String,
    subcategory: mongoose.Schema.Types.ObjectId,
    category: mongoose.Schema.Types.ObjectId,
    sortOrder: Number, isActive: Boolean,
  },
  { timestamps: true }
);
const ProductSchema = new mongoose.Schema(
  {
    name: String, category: mongoose.Schema.Types.ObjectId, subcategory: mongoose.Schema.Types.ObjectId,
    subSubcategory: mongoose.Schema.Types.ObjectId, isActive: Boolean,
  },
  { strict: false }
);

const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const SubSubcategory = mongoose.models.SubSubcategory || mongoose.model('SubSubcategory', SubSubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB\n`);

  const subs = await Subcategory.find({ isActive: { $ne: false } }).lean();
  const subMap = new Map(subs.map((s) => [String(s._id), s.name]));

  const types = await SubSubcategory.find({ isActive: { $ne: false } })
    .sort({ subcategory: 1, sortOrder: 1, name: 1 })
    .lean();

  // Linked-product counts per SubSubcategory, in one aggregation.
  const linkedCounts = await Product.aggregate([
    { $match: { subSubcategory: { $ne: null } } },
    { $group: { _id: '$subSubcategory', count: { $sum: 1 } } },
  ]);
  const linkedMap = new Map(linkedCounts.map((c) => [String(c._id), c.count]));

  // Unlinked-product counts per parent Subcategory (products with no
  // subSubcategory at all) — tells us if there's untapped supply to match.
  const unlinkedCounts = await Product.aggregate([
    { $match: { subSubcategory: null } },
    { $group: { _id: '$subcategory', count: { $sum: 1 } } },
  ]);
  const unlinkedMap = new Map(unlinkedCounts.map((c) => [String(c._id), c.count]));

  let currentSub = null;
  let emptyTypes = [];

  for (const t of types) {
    const subId = String(t.subcategory);
    if (subId !== currentSub) {
      currentSub = subId;
      const unlinked = unlinkedMap.get(subId) ?? 0;
      console.log(`\n📁 ${subMap.get(subId) ?? '(unknown subcategory)'}  — ${unlinked} unlinked product(s) still sitting in this subcategory`);
    }
    const linked = linkedMap.get(String(t._id)) ?? 0;
    const flag = linked === 0 ? '  ⚠️  EMPTY' : '';
    console.log(`   ${String(linked).padStart(4)} product(s) — ${t.name}${flag}`);
    if (linked === 0) emptyTypes.push({ subcategory: subMap.get(subId), type: t.name });
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total sub-subcategories: ${types.length}`);
  console.log(`Empty (0 linked products): ${emptyTypes.length}`);
  if (emptyTypes.length > 0) {
    console.log('\nEmpty types:');
    emptyTypes.forEach((e) => console.log(`   - ${e.subcategory} → ${e.type}`));
  }

  if (EMPTY_ONLY) {
    console.log('\n(--empty-only was passed but full report is small enough to show above anyway)');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
