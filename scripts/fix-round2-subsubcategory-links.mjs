/**
 * Relinks products for the "round 2" categories confirmed via manual
 * legacy-site check on 2026-08-31: More Gemstone Rings, Diamond Loupe,
 * Wish Pearl Necklace, Silk Cord Necklace, Silk Cords, Silver Solitaire
 * Pendants, Diamond Stud Earrings (In Silver).
 *
 * import-scraped-products.mjs confirmed all 687 scraped items (round 1 +
 * round 2 combined) already exist in the DB by legacyProductId (0 created,
 * 687/687 already existing) — so, same as Calibrated Tanzanite before it,
 * this is a pure relink, not an import. Every "empty" category in this
 * project so far has turned out to be a linking problem, never a true
 * catalog gap.
 *
 * Deliberately EXCLUDES:
 *   - The 8 categories already fixed by fix-safe-subsubcategory-links.mjs
 *     and fix-tanzanite-pair-links.mjs (Bridal Rings, Right Hand Rings,
 *     Tanzanite Earrings, Diamond Earring Bargains, Diamond Fashion
 *     Pendants, Cocktail Rings, Calibrated Tanzanite, Emerald Cut
 *     Tanzanite) — already committed, don't touch again.
 *   - Bridal Diamond Rings — still pending the cross-listing decision
 *     (legacy cross-lists it under both Bridal Diamond Rings and
 *     Engagement Solitaire Rings; our schema's crossListedSubcategoryIds
 *     only works at the Subcategory level, not subSubcategory). Do not
 *     add here without an explicit decision on that question first.
 *
 * NOTE on legacyProductId 6719: it's scraped under BOTH "Silk Cord
 * Necklace" and "Silk Cords" (legacy cross-lists it there too, same
 * limitation as above). This script processes SAFE_TARGETS in the order
 * below, so whichever entry is processed LAST for a given legacyProductId
 * wins the final subSubcategory — Silk Cords is listed after Silk Cord
 * Necklace, so 6719 will end up under Silk Cords. That's an arbitrary but
 * harmless pick given cross-listing isn't supported; revisit once/if the
 * cross-listing schema question is resolved.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 * USAGE:
 *   node scripts/fix-round2-subsubcategory-links.mjs
 *   node scripts/fix-round2-subsubcategory-links.mjs --commit
 */

import fs from 'node:fs';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');
const SCRAPED_FILE = 'scripts/output/scraped-products.json';

if (!fs.existsSync(SCRAPED_FILE)) {
  console.error(`❌ ${SCRAPED_FILE} not found — run scrape-missing-products.mjs first.`);
  process.exit(1);
}

// Order matters for the 6719 cross-listing case noted above — keep
// Silk Cord Necklace before Silk Cords.
const SAFE_TARGETS = [
  'More Gemstone Rings',
  'Diamond Loupe',
  'Wish Pearl Necklace',
  'Silk Cord Necklace',
  'Silk Cords',
  'Silver Solitaire Pendants',
  'Diamond Stud Earrings in Silver',
];
const SAFE_TARGETS_SET = new Set(SAFE_TARGETS);

// The scraper tagged this batch's items using the legacy site's own
// (slightly garbled — legacy is even missing its own closing paren)
// breadcrumb text "Diamond Stud Earrings (In Silver)", but the real
// taxonomy name in this DB is "Diamond Stud Earrings in Silver" — confirmed
// against report-subsubcategory-counts.mjs's original empty-category list.
// Map the scraped label to the real taxonomy name here rather than
// re-scraping.
const SCRAPED_LABEL_ALIASES = new Map([
  ['Diamond Stud Earrings (In Silver)', 'Diamond Stud Earrings in Silver'],
]);
function resolveTaxonomyName(scrapedLabel) {
  return SCRAPED_LABEL_ALIASES.get(scrapedLabel) || scrapedLabel;
}

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  const scraped = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf-8'));

  // Preserve TARGETS scrape order (order items appear in the file), then
  // stable-sort by SAFE_TARGETS priority so a later-priority entry for the
  // same legacyProductId is processed last and wins, per the 6719 note.
  const priority = new Map(SAFE_TARGETS.map((name, i) => [name, i]));
  const targets = scraped
    .filter((item) => SAFE_TARGETS_SET.has(resolveTaxonomyName(item.subSubcategory)))
    .sort((a, b) => priority.get(resolveTaxonomyName(a.subSubcategory)) - priority.get(resolveTaxonomyName(b.subSubcategory)));

  console.log(`Loaded ${scraped.length} scraped item(s), ${targets.length} in the round-2 fix scope.\n`);

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}\n`);

  const subSubDocs = new Map();
  for (const name of SAFE_TARGETS) {
    const doc = await SubSubcategory.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
    if (!doc) {
      console.log(`⚠️  SubSubcategory "${name}" not found in DB — items for it will be skipped.`);
    }
    subSubDocs.set(name, doc || null);
  }

  let fixed = 0, alreadyCorrect = 0, notFoundInDb = 0, noTaxonomyDoc = 0;
  const perCategory = new Map();

  for (const item of targets) {
    const taxonomyName = resolveTaxonomyName(item.subSubcategory);
    const targetDoc = subSubDocs.get(taxonomyName);
    if (!targetDoc) {
      noTaxonomyDoc++;
      continue;
    }

    const legacyId = Number(item.legacyProductId);
    if (!Number.isFinite(legacyId)) {
      console.log(`   [${item.legacyProductId}] unparseable legacyProductId — skipping "${item.name}"`);
      notFoundInDb++;
      continue;
    }

    const product = await Product.findOne({ legacyProductId: legacyId }).lean();
    if (!product) {
      notFoundInDb++;
      console.log(`   [${legacyId}] not in DB at all — "${item.name}" (${taxonomyName})`);
      continue;
    }

    if (String(product.subSubcategory) === String(targetDoc._id)) {
      alreadyCorrect++;
      continue;
    }

    if (COMMIT) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            subSubcategory: targetDoc._id,
            subcategory2Raw: targetDoc.name,
            category: targetDoc.category,
            subcategory: targetDoc.subcategory,
          },
        }
      );
    }
    fixed++;
    perCategory.set(taxonomyName, (perCategory.get(taxonomyName) || 0) + 1);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Products ${COMMIT ? 'fixed' : 'that would be fixed'}: ${fixed}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Not found in DB: ${notFoundInDb}`);
  console.log(`Skipped (target subSubcategory missing from taxonomy): ${noTaxonomyDoc}`);

  if (perCategory.size > 0) {
    console.log('\nBy category:');
    for (const name of SAFE_TARGETS) {
      if (perCategory.has(name)) console.log(`   ${perCategory.get(name)} — ${name}`);
    }
  }

  if (!COMMIT) {
    console.log('\nThis was a dry run. Re-run with --commit to actually write.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});