/**
 * Follow-up to report-subsubcategory-counts.mjs.
 *
 * Of the 4 flagged-empty subSubcategories, 2 are already explained:
 *   - Bridal Diamond Rings: known cross-listing case (deferred decision,
 *     see fix-round2-subsubcategory-links.mjs header notes).
 *   - Silk Cord Necklace: legacyProductId 6719 is cross-listed with
 *     "Silk Cords" and was deliberately assigned to Silk Cords by
 *     fix-round2-subsubcategory-links.mjs. Not a bug — expected empty.
 *
 * This script checks the other 2 (plus re-confirms Bridal Diamond Rings)
 * the same way we resolved Silver Earrings: instead of re-scraping the
 * legacy site, it uses each product's OWN stored legacy breadcrumb text
 * (categoryPath / subcategory2Raw, set at import time) to find every
 * product that legacy ever filed under that name, then reports where
 * each one is ACTUALLY linked right now.
 *
 * Read-only. Writes nothing.
 *
 * USAGE:
 *   node scripts/diagnose-remaining-empty-subsubcategories.mjs
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

// Targets to check. Include a couple of likely legacy-name variants per
// target, since the seed taxonomy name and the scraped breadcrumb text
// don't always match exactly (see diagnose-subsubcategory-mismatch.mjs).
const TARGETS = [
  { subSubName: 'Bridal Diamond Rings', pathNeedles: ['Bridal Diamond Rings'] },
  { subSubName: 'Silver Brooch', pathNeedles: ['Silver Brooch', 'Brooch'] },
  { subSubName: 'Diamond Earrings', parentSubcategory: 'Bargains', pathNeedles: ['Diamond Earrings'] },
];

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const SubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });

const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Subcategory = mongoose.model('Subcategory', SubcategorySchema, 'subcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const allSubSub = await SubSubcategory.find({}).select({ name: 1, subcategory: 1 }).lean();
  const allSub = await Subcategory.find({}).select({ name: 1 }).lean();
  const subNameById = new Map(allSub.map((s) => [String(s._id), s.name]));
  const subSubById = new Map(allSubSub.map((s) => [String(s._id), s]));

  for (const target of TARGETS) {
    console.log('─'.repeat(70));
    const label = target.parentSubcategory
      ? `${target.parentSubcategory} → ${target.subSubName}`
      : target.subSubName;
    console.log(`Target: ${label}`);

    // Resolve the specific empty doc's _id (there can be more than one
    // SubSubcategory sharing a name across different parents, as we saw
    // with "Diamond Earrings" itself).
    let candidateDocs = allSubSub.filter((s) => s.name.trim().toLowerCase() === target.subSubName.toLowerCase());
    if (target.parentSubcategory) {
      candidateDocs = candidateDocs.filter(
        (s) => (subNameById.get(String(s.subcategory)) || '').toLowerCase() === target.parentSubcategory.toLowerCase()
      );
    }
    if (candidateDocs.length !== 1) {
      console.log(`   ⚠️  Expected exactly 1 matching SubSubcategory doc, found ${candidateDocs.length}. Skipping — resolve manually.`);
      continue;
    }
    const targetDoc = candidateDocs[0];

    // Find every product whose stored legacy breadcrumb mentions this name.
    const orClauses = target.pathNeedles.flatMap((needle) => [
      { categoryPath: new RegExp(esc(needle), 'i') },
      { subcategory2Raw: new RegExp(esc(needle), 'i') },
    ]);
    const matches = await Product.find({ $or: orClauses })
      .select({ name: 1, categoryPath: 1, subcategory2Raw: 1, subSubcategory: 1, legacyProductId: 1 })
      .lean();

    console.log(`   ${matches.length} product(s) in DB with a legacy breadcrumb mentioning "${target.subSubName}"`);

    if (matches.length === 0) {
      console.log('   → Nothing in DB references this category at all. Either a genuine gap (needs scraping)');
      console.log('     or this legacy category never got scraped/imported in the first place.');
      continue;
    }

    const buckets = new Map(); // currentSubSubName -> [{name, legacyProductId}]
    for (const p of matches) {
      const currentName = p.subSubcategory
        ? (subSubById.get(String(p.subSubcategory))?.name ?? '(unknown/deleted subSubcategory)')
        : '(never linked)';
      if (!buckets.has(currentName)) buckets.set(currentName, []);
      buckets.get(currentName).push(p);
    }

    for (const [currentName, items] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const flag = currentName === target.subSubName ? '  ← already correct?!' : '';
      console.log(`      ${String(items.length).padStart(4)}  currently: ${currentName}${flag}`);
      items.slice(0, 5).forEach((p) => console.log(`            [${p.legacyProductId ?? '?'}] ${p.name}`));
      if (items.length > 5) console.log(`            ...and ${items.length - 5} more`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('Read-only — nothing written.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});