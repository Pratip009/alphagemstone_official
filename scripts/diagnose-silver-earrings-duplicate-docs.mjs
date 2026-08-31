/**
 * Follow-up to diagnose-silver-earrings-legacy-only.mjs.
 *
 * That script found all 144 "legacy-only" products are already in the DB,
 * linked to a subSubcategory literally named "Silver Earrings" — a
 * DIFFERENT document than "Gemstone Silver Earrings" (which holds the
 * other 315/331).
 *
 * This raises the question: is "Silver Earrings" the same subSubcategory
 * your original empty-category report flagged as having 0 products, or
 * is it a second, duplicate document (orphaned / not wired into nav /
 * not what the report queries)?
 *
 * This script is read-only. It:
 *   1. Finds every subSubcategory document whose name matches /silver
 *      earrings/i (case-insensitive, so it catches exact dupes and near
 *      variants).
 *   2. For each one, reports: _id, parent subcategory/category chain,
 *      legacy path fields if present, and how many Products currently
 *      point subSubcategory at that _id.
 *   3. Flags if more than one doc shares the same normalized name —
 *      that's the duplicate-document scenario.
 *
 * USAGE:
 *   node scripts/diagnose-silver-earrings-duplicate-docs.mjs
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

async function main() {
  const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
  const SubcategorySchema = new mongoose.Schema({}, { strict: false });
  const CategorySchema = new mongoose.Schema({}, { strict: false });
  const ProductSchema = new mongoose.Schema({}, { strict: false });

  const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
  const Subcategory = mongoose.model('Subcategory', SubcategorySchema, 'subcategories');
  const Category = mongoose.model('Category', CategorySchema, 'categories');
  const Product = mongoose.model('Product', ProductSchema, 'products');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const docs = await SubSubcategory.find({ name: /silver earrings/i }).lean();

  console.log(`Found ${docs.length} subSubcategory document(s) matching /silver earrings/i:\n`);

  if (docs.length === 0) {
    console.log('Nothing matched — check the regex / collection name.');
    await mongoose.disconnect();
    return;
  }

  const byNormName = {};

  for (const doc of docs) {
    const productCount = await Product.countDocuments({ subSubcategory: doc._id });

    let subcatName = null;
    let catName = null;
    if (doc.subcategory) {
      const subcat = await Subcategory.findById(doc.subcategory).lean();
      subcatName = subcat?.name || null;
      if (subcat?.category) {
        const cat = await Category.findById(subcat.category).lean();
        catName = cat?.name || null;
      }
    }

    console.log('─'.repeat(70));
    console.log(`name:            ${doc.name}`);
    console.log(`_id:             ${doc._id}`);
    console.log(`parent chain:    ${catName ?? '?'} > ${subcatName ?? '?'} > ${doc.name}`);
    console.log(`linked products: ${productCount}`);
    // Print any other fields that look like legacy identifiers, since the
    // report script / original bug involved id-shape mismatches.
    const legacyLikeFields = Object.keys(doc).filter((k) => /legacy|slug|path|url/i.test(k));
    for (const k of legacyLikeFields) {
      console.log(`${k}: ${JSON.stringify(doc[k])}`);
    }

    const norm = doc.name.trim().toLowerCase();
    byNormName[norm] = byNormName[norm] || [];
    byNormName[norm].push({ id: String(doc._id), productCount });
  }

  console.log('\n' + '─'.repeat(70));
  const dupeGroups = Object.entries(byNormName).filter(([, arr]) => arr.length > 1);
  if (dupeGroups.length > 0) {
    console.log(`⚠️  Duplicate name(s) found — same name, different _id:\n`);
    for (const [name, arr] of dupeGroups) {
      console.log(`"${name}":`);
      arr.forEach((d) => console.log(`   _id=${d.id}  products=${d.productCount}`));
    }
    console.log(`\nThis is almost certainly the same bug shape as Round 1 (JS type mismatch)`);
    console.log(`or a leftover duplicate from migration. Whichever _id your`);
    console.log(`report-subsubcategory-counts.mjs / site nav actually queries against`);
    console.log(`is the "real" one — the other is an orphan holding real, already-migrated`);
    console.log(`products that just need their subSubcategory pointer corrected.`);
  } else {
    console.log(`No duplicate names — only one "Silver Earrings"-ish document exists.`);
    console.log(`In that case, "Silver Earrings" (144 products) and "Gemstone Silver`);
    console.log(`Earrings" (331 products) are genuinely two separate, correctly-wired`);
    console.log(`categories, and the original "empty category" report was likely just`);
    console.log(`wrong about this one — worth re-running report-subsubcategory-counts.mjs`);
    console.log(`filtered to this specific _id to confirm.`);
  }

  console.log('\nRead-only — nothing written.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
