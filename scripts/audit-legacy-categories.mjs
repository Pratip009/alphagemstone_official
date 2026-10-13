/**
 * READ-ONLY audit: did every alphaimports.com category survive the move?
 *
 * For every category path a product had on the old site (src/lib/products.csv,
 * active products only, all cross-listings included) this reports:
 *   - how many products the old category had,
 *   - how many of those exist in the new database (by legacyProductId),
 *   - whether a category / subcategory / sub-subcategory with the same name
 *     exists on the new site, and
 *   - how many of the old products are actually INSIDE that new category
 *     (what a customer clicking it would see).
 *
 * Problems are printed to the console; the full table is written to
 * scripts/output/legacy-category-audit.csv. Writes nothing to the database.
 *
 * USAGE:
 *   node scripts/audit-legacy-categories.mjs
 */

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const CSV_PATH = path.resolve('src/lib/products.csv');
const OUT_PATH = path.resolve('scripts/output/legacy-category-audit.csv');
// Old-site buckets that were never meant to be shop categories.
const IGNORE = new Set(['vouchers', 'certificates']);

const loose = (name) => new mongoose.Schema({}, { strict: false, collection: name });
const Category = mongoose.model('Category', loose('categories'));
const Subcategory = mongoose.model('Subcategory', loose('subcategories'));
const SubSubcategory = mongoose.model('SubSubcategory', loose('subsubcategories'));
const Product = mongoose.model('Product', loose('products'));

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, ''); // "Faceted Emeralds" ≈ "Faceted Emerald"

function readLegacy() {
  return new Promise((resolve, reject) => {
    const byPath = new Map();
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (r) => {
        if (String(r.status).toLowerCase() !== 'true') return;
        const id = Number(r.product_id);
        for (const p of String(r.category_paths_all || '').split('|').map((x) => x.trim()).filter(Boolean)) {
          if (!byPath.has(p)) byPath.set(p, new Set());
          byPath.get(p).add(id);
        }
      })
      .on('end', () => resolve(byPath))
      .on('error', reject);
  });
}

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;

async function main() {
  const legacy = await readLegacy();
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected (read-only). Old category paths: ${legacy.size}\n`);

  const [cats, subs, subsubs] = await Promise.all([
    Category.find({}).select({ name: 1, isActive: 1 }).lean(),
    Subcategory.find({}).select({ name: 1, category: 1, isActive: 1 }).lean(),
    SubSubcategory.find({}).select({ name: 1, subcategory: 1, isActive: 1 }).lean(),
  ]);

  // All legacy ids → current placement, in one query.
  const allIds = [...new Set([...legacy.values()].flatMap((s) => [...s]))];
  const products = await Product.find({ legacyProductId: { $in: allIds } })
    .select({ legacyProductId: 1, isActive: 1, category: 1, subcategory: 1, subSubcategory: 1, crossListedSubcategoryIds: 1 })
    .lean();
  const byLegacy = new Map(products.map((p) => [p.legacyProductId, p]));

  // Find the new node that corresponds to an old path, matching parent names too.
  function findNode(parts) {
    const [c, s, ss] = parts.map(norm);
    const leaf = parts.length;
    const cat = cats.find((x) => norm(x.name) === c);
    if (leaf === 1) return cat ? { level: 'category', node: cat } : null;
    const subsUnder = subs.filter((x) => !cat || String(x.category) === String(cat._id));
    const sub = subsUnder.find((x) => norm(x.name) === s) ?? subs.find((x) => norm(x.name) === s);
    if (leaf === 2) return sub ? { level: 'subcategory', node: sub } : null;
    // Old paths can be 4 deep (e.g. Sapphire > Blue Sapphire > Faceted Blue Sapphire): match on the last part.
    const leafName = norm(parts[parts.length - 1]);
    const pool = sub ? subsubs.filter((x) => String(x.subcategory) === String(sub._id)) : subsubs;
    const hit = pool.find((x) => norm(x.name) === leafName) ?? (sub ? null : subsubs.find((x) => norm(x.name) === leafName));
    return hit ? { level: 'sub-subcategory', node: hit } : null;
  }

  const rows = [];
  for (const [oldPath, idSet] of legacy) {
    const parts = oldPath.split('>').map((x) => x.trim());
    if (IGNORE.has(norm(parts[0]))) continue;
    const ids = [...idSet];
    const inDb = ids.filter((id) => byLegacy.has(id));
    const active = inDb.filter((id) => byLegacy.get(id).isActive !== false);
    const match = findNode(parts);
    const field = match && { category: 'category', subcategory: 'subcategory', 'sub-subcategory': 'subSubcategory' }[match.level];
    const target = match && String(match.node._id);
    const isIn = (p) =>
      String(p[field]) === target ||
      // Subcategory-level cross-listing (crossListedSubcategoryIds) also shows the product there.
      (field === 'subcategory' && (p.crossListedSubcategoryIds ?? []).some((x) => String(x) === target));
    const visible = match ? active.filter((id) => isIn(byLegacy.get(id))).length : 0;

    const issues = [];
    if (!match) issues.push('NO CATEGORY ON NEW SITE');
    else if (match.node.isActive === false) issues.push('NEW CATEGORY IS HIDDEN');
    if (inDb.length < ids.length) issues.push(`${ids.length - inDb.length} NOT TRANSFERRED`);
    if (active.length < inDb.length) issues.push(`${inDb.length - active.length} INACTIVE`);
    if (match && visible < active.length) issues.push(`${active.length - visible} NOT IN THIS CATEGORY`);

    rows.push({ oldPath, old: ids.length, inDb: inDb.length, active: active.length, newCategory: match ? `${match.level}: ${match.node.name}` : '', visible, issues: issues.join('; ') });
  }

  rows.sort((a, b) => (b.issues ? 1 : 0) - (a.issues ? 1 : 0) || b.old - a.old);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    ['old_category,old_products,in_new_db,active,new_category,customers_see_in_it,issues', ...rows.map((r) => [r.oldPath, r.old, r.inDb, r.active, r.newCategory, r.visible, r.issues].map(csvCell).join(','))].join('\n'),
  );

  const bad = rows.filter((r) => r.issues);
  console.log(`Old categories checked: ${rows.length}   With problems: ${bad.length}\n`);
  for (const r of bad) {
    console.log(`${r.oldPath}`);
    console.log(`   old ${r.old} · transferred ${r.inDb} · customers see ${r.visible} in "${r.newCategory || '—'}"  →  ${r.issues}`);
  }
  console.log(`\nFull report: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
