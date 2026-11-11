/**
 * Restores a sub-subcategory to exactly the products it had on
 * alphaimports.com, using the legacy category id from the old site's URL
 * (…-c-24_132_133.html → legacy id 133).
 *
 * WHY: scripts/lib/subsubcategory-taxonomy.mjs links products by keywords in
 * the product NAME (e.g. Diamond Solitaire Pendants needs "solitaire"). Real
 * legacy names are like "0.25 Cts. Blue Diamond Pendant in 14k Gold", so most
 * products never matched. This script instead reads the real legacy
 * membership from src/lib/products.csv (`category_ids`) — no name guessing.
 *
 * WHAT IT DOES:
 *   - Finds (or creates) the target sub-subcategory under Category → Subcategory.
 *   - For every legacy product (matched by legacyProductId):
 *       right subcategory, no sub-subcategory   → set as its sub-subcategory
 *       right subcategory, other sub-subcategory → cross-listed (keeps the other)
 *       different subcategory (e.g. a Tanzanite
 *       pendant that is ALSO a solitaire pendant) → cross-listed at both levels;
 *                                                 its real category is untouched
 *   - Inactive products and products missing from the DB are only reported.
 *
 * Cross-listing needs the crossListedSubSubcategoryIds support in
 * src/models/Product.ts + src/services/productFilter.service.ts to be DEPLOYED,
 * otherwise cross-listed products won't show on the storefront.
 *
 * DRY-RUN by default — prints the plan and writes nothing.
 *
 * USAGE (preset):
 *   node scripts/restore-legacy-subsubcategory.mjs --preset diamond-solitaire-pendants
 *   node scripts/restore-legacy-subsubcategory.mjs --preset diamond-solitaire-pendants --commit
 *   node scripts/restore-legacy-subsubcategory.mjs --preset semi-mountings --commit
 *   node scripts/restore-legacy-subsubcategory.mjs --preset all --commit
 *
 * USAGE (any other category — take the last number from the old URL):
 *   node scripts/restore-legacy-subsubcategory.mjs --legacy 133 \
 *     --category "Jewelry" --subcategory "Diamond Pendants" --target "Diamond Solitaire Pendants"
 */

import fs from 'node:fs';
import path from 'node:path';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const PRESETS = {
  'diamond-solitaire-pendants': {
    legacy: 133, category: 'Jewelry', subcategory: 'Diamond Pendants', target: 'Diamond Solitaire Pendants',
  },
  'wedding-diamond-bands': {
    legacy: 245, category: 'Jewelry', subcategory: 'Diamond Rings', target: 'Wedding Diamond Bands',
    aliases: ['Diamond Wedding Bands', 'Wedding Bands'],
  },
  'color-diamond-rings': {
    legacy: 128, category: 'Jewelry', subcategory: 'Diamond Rings', target: 'Color Diamond Rings',
    aliases: ['Colour Diamond Rings', 'Colored Diamond Rings'],
  },
  'engagement-solitaire-rings': {
    legacy: 125, category: 'Jewelry', subcategory: 'Diamond Rings', target: 'Engagement Solitaire Rings',
  },

  // ── Jewelry → Gold Diamond Semi-mountings (old URL …-c-24_144_<id>.html) ──
  'semi-mount-engagement-rings': {
    legacy: 179, category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', target: 'Engagement Rings',
  },
  'semi-mount-bridal-rings': {
    legacy: 180, category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', target: 'Bridal Rings',
  },
  'semi-mount-past-present-future': {
    legacy: 181, category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', target: 'Past, Present & Future Rings',
    aliases: ['Past Present Future', 'Past Present Future Rings', 'Past, Present and Future Rings', 'Past Present & Future Rings'],
  },
  'semi-mount-right-hand-rings': {
    legacy: 182, category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', target: 'Right Hand Rings',
  },
};

// Run several presets with one flag, e.g. --preset semi-mountings
const PRESET_GROUPS = {
  'semi-mountings': [
    'semi-mount-engagement-rings', 'semi-mount-bridal-rings',
    'semi-mount-past-present-future', 'semi-mount-right-hand-rings',
  ],
};

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const COMMIT = argv.includes('--commit');

function jobsFromArgs() {
  const preset = arg('preset');
  if (preset === 'all') return Object.values(PRESETS);
  if (PRESET_GROUPS[preset]) return PRESET_GROUPS[preset].map((k) => PRESETS[k]);
  if (preset) {
    if (!PRESETS[preset]) throw new Error(`Unknown preset "${preset}". Known: ${[...Object.keys(PRESETS), ...Object.keys(PRESET_GROUPS)].join(', ')}, all`);
    return [PRESETS[preset]];
  }
  const job = {
    legacy: Number(arg('legacy')),
    category: arg('category'),
    subcategory: arg('subcategory'),
    target: arg('target'),
  };
  if (!job.legacy || !job.category || !job.subcategory || !job.target) {
    throw new Error('Pass --preset <name>, or all of --legacy --category --subcategory --target');
  }
  return [job];
}

// ── helpers ─────────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ci = (s) => new RegExp(`^${esc(s)}$`, 'i');
// Same as scripts/lib/subsubcategory-taxonomy.mjs, so existing slugs match.
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Lookup tolerates either "&" convention so an existing row is never duplicated.
const slugVariants = (s) => [...new Set([slugify(s), slugify(s.replace(/&/g, 'and'))])];

function parseIds(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw).map(String);
  } catch {
    return String(raw).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  }
}

async function loadLegacyMembership() {
  const file = path.resolve('src/lib/products.csv');
  const byCategory = new Map();
  await new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on('data', (row) => {
        const pid = Number(row.product_id);
        if (!pid) return;
        for (const c of parseIds(row.category_ids)) {
          if (!byCategory.has(c)) byCategory.set(c, []);
          byCategory.get(c).push(pid);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });
  return byCategory;
}

const loose = (name) => new mongoose.Schema({}, { strict: false, collection: name });
const Category = mongoose.model('Category', loose('categories'));
const Subcategory = mongoose.model('Subcategory', loose('subcategories'));
const SubSubcategory = mongoose.model('SubSubcategory', loose('subsubcategories'));
const Product = mongoose.model('Product', loose('products'));

// ── one job ─────────────────────────────────────────────────────────────────
async function runJob(job, membership) {
  const legacyIds = [...new Set(membership.get(String(job.legacy)) ?? [])];
  console.log(`\n━━━ ${job.category} → ${job.subcategory} → ${job.target}  (legacy ${job.legacy}) ━━━`);
  console.log(`Products on the old site: ${legacyIds.length}`);
  if (!legacyIds.length) {
    console.log('Nothing to do (no products with that legacy category id in products.csv).');
    return;
  }

  const cat = await Category.findOne({ name: ci(job.category) }).lean();
  if (!cat) throw new Error(`Category "${job.category}" not found`);
  const sub = await Subcategory.findOne({ name: ci(job.subcategory), category: cat._id }).lean();
  if (!sub) throw new Error(`Subcategory "${job.subcategory}" not found under ${job.category}`);

  const names = [job.target, ...(job.aliases ?? [])];
  let target = await SubSubcategory.findOne({
    subcategory: sub._id,
    $or: [{ slug: { $in: names.flatMap(slugVariants) } }, { name: { $in: names.map(ci) } }],
  }).lean();
  console.log(target
    ? `Sub-subcategory exists: "${target.name}" (${target._id})${target.isActive === false ? '  ⚠️ INACTIVE — will be re-activated' : ''}`
    : `Sub-subcategory "${job.target}" is MISSING — will be created`);

  const products = await Product.find({ legacyProductId: { $in: legacyIds } })
    .select({
      name: 1, legacyProductId: 1, legacySku: 1, isActive: 1, subcategory: 1, subSubcategory: 1,
      crossListedSubcategoryIds: 1, crossListedSubSubcategoryIds: 1,
    })
    .lean();
  const foundIds = new Set(products.map((p) => p.legacyProductId));
  const notInDb = legacyIds.filter((id) => !foundIds.has(id));

  const refIds = [...products.map((p) => p.subSubcategory), ...products.map((p) => p.subcategory)].filter(Boolean);
  const refNames = new Map([
    ...(await SubSubcategory.find({ _id: { $in: refIds } }).select({ name: 1 }).lean()).map((s) => [String(s._id), s.name]),
    ...(await Subcategory.find({ _id: { $in: refIds } }).select({ name: 1 }).lean()).map((s) => [String(s._id), s.name]),
  ]);
  const label = (id) => refNames.get(String(id)) ?? String(id);

  const tid = target ? String(target._id) : null;
  const has = (arr, id) => (arr ?? []).some((x) => String(x) === id);
  const inTargetSub = (p) => String(p.subcategory) === String(sub._id) || has(p.crossListedSubcategoryIds, String(sub._id));
  const inTarget = (p) => tid && inTargetSub(p) && (String(p.subSubcategory) === tid || has(p.crossListedSubSubcategoryIds, tid));

  const already = [], link = [], crossSubSub = [], crossBoth = [], inactive = [];
  for (const p of products) {
    if (p.isActive === false) inactive.push(p);
    if (inTarget(p)) already.push(p);
    else if (String(p.subcategory) !== String(sub._id)) crossBoth.push(p);
    else if (!p.subSubcategory) link.push(p);
    else crossSubSub.push(p);
  }

  const show = (p, extra = '') => console.log(`   • ${p.legacyProductId} ${p.legacySku ?? ''} "${p.name}"${extra}`);
  console.log(`Found in DB:              ${products.length} / ${legacyIds.length}`);
  console.log(`Already showing there:    ${already.length}`);
  console.log(`Will be linked:           ${link.length}`);
  link.forEach((p) => show(p));
  console.log(`Will be cross-listed:     ${crossSubSub.length + crossBoth.length}  (keep their current place too)`);
  crossSubSub.forEach((p) => show(p, ` — primary: ${job.subcategory} → ${label(p.subSubcategory)}`));
  crossBoth.forEach((p) => show(p, ` — primary: ${label(p.subcategory)}${p.subSubcategory ? ` → ${label(p.subSubcategory)}` : ''}`));
  if (inactive.length) {
    console.log(`⚠️  Inactive (hidden from customers): ${inactive.length} — NOT changed, review in admin:`);
    inactive.forEach((p) => show(p));
  }
  if (notInDb.length) console.log(`❌ Not in the database at all: ${notInDb.length} — ${notInDb.join(', ')}`);

  if (!COMMIT) return;

  if (!target) {
    const [created] = await SubSubcategory.create([{
      name: job.target, slug: slugify(job.target), subcategory: sub._id, category: cat._id, sortOrder: 0, isActive: true,
    }]);
    target = created.toObject();
    console.log(`➕ Created sub-subcategory ${target._id}`);
  } else if (target.isActive === false) {
    await SubSubcategory.updateOne({ _id: target._id }, { $set: { isActive: true } });
    console.log('✔ Re-activated sub-subcategory');
  }

  const ops = [
    ...link.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { subSubcategory: target._id } } },
    })),
    ...crossSubSub.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $addToSet: { crossListedSubSubcategoryIds: target._id } } },
    })),
    ...crossBoth.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $addToSet: { crossListedSubcategoryIds: sub._id, crossListedSubSubcategoryIds: target._id } },
      },
    })),
  ];
  if (ops.length) {
    const res = await Product.bulkWrite(ops);
    console.log(`✔ Updated ${res.modifiedCount} product(s).`);
  }

  const total = await Product.countDocuments({
    isActive: { $ne: false },
    $and: [
      { $or: [{ subcategory: sub._id }, { crossListedSubcategoryIds: sub._id }] },
      { $or: [{ subSubcategory: target._id }, { crossListedSubSubcategoryIds: target._id }] },
    ],
  });
  console.log(`${target.name} now shows ${total} active product(s).`);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const jobs = jobsFromArgs();
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (checked .env.local and .env)');

  const membership = await loadLegacyMembership();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : '  (DRY RUN — pass --commit to write)'}`);

  for (const job of jobs) await runJob(job, membership);

  console.log(COMMIT
    ? '\nDone. Pages refresh within ~5 minutes (site cache), or redeploy to see it immediately.'
    : '\nDry run only. Re-run with --commit to apply.');
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
