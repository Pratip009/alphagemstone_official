/**
 * Move the legacy "Precious gems deals and steals" products (old
 * alphaimports.com category 22_197, 1293 products) back into
 *   Precious Gems > Precious gems deals and steals
 * on the new site.
 *
 * Why it's empty: scripts/populate-wholesale-lots.mjs and
 * scripts/create-more-specials-subcategory.mjs moved these products into
 * Wholesale Lots > Precious Gems Lots and Specials > More Specials.
 *
 * Products are matched by legacyProductId (= old products_id), falling back
 * to legacySku (= old products_model). The product IDs come from the
 * precious_gems.tsv export pulled from the old MySQL database.
 *
 * SAFE BY DEFAULT: without --apply it only reports what it would do.
 * Before writing, it saves a backup of every product's current
 * category/subcategory/subSubcategory so the move can be undone with --restore.
 *
 * Usage (run from the project root, where .env.local has MONGODB_URI):
 *   node scripts/move-to-precious-gems-deals.mjs data/precious_gems.tsv
 *   node scripts/move-to-precious-gems-deals.mjs data/precious_gems.tsv --apply
 *   node scripts/move-to-precious-gems-deals.mjs data/precious_gems.tsv --apply --keep-more-specials
 *   node scripts/move-to-precious-gems-deals.mjs --restore backups/precious-gems-move-<time>.json
 */
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (expected in .env.local). Aborting.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const KEEP_MORE_SPECIALS = args.includes('--keep-more-specials');
const restoreIdx = args.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? args[restoreIdx + 1] : null;
const TSV_PATH = args.find((a) => !a.startsWith('--') && a !== RESTORE_FILE);

const TARGET_CATEGORY_SLUG = 'precious-gems';
const TARGET_SUBCATEGORY_SLUG = 'precious-gems-deals-and-steals';
const MOVED_FIELDS = ['category', 'subcategory', 'subSubcategory'];

// ─── Read the export from the old site ──────────────────────────────────────
function readLegacyExport(file) {
  if (!file || !fs.existsSync(file)) {
    console.error(`❌ Export file not found: ${file ?? '(none given)'}`);
    console.error('   Pass the path to precious_gems.tsv as the first argument.');
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split('\t');
  const idCol = header.indexOf('products_id');
  const skuCol = header.indexOf('products_model');
  if (idCol < 0) {
    console.error('❌ No products_id column in the export header. Is this the right file?');
    process.exit(1);
  }
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split('\t');
    const id = Number(cols[idCol]);
    if (!Number.isInteger(id)) continue;
    const sku = skuCol >= 0 && cols[skuCol] && cols[skuCol] !== 'NULL' ? cols[skuCol].trim() : null;
    rows.push({ id, sku });
  }
  return rows;
}

// ─── Restore from a backup file ─────────────────────────────────────────────
async function restore(products, file) {
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`♻️  Restoring ${backup.length} products from ${file}${APPLY ? '' : ' (dry run, add --apply to write)'}`);
  const ops = backup.map((b) => {
    const $set = { updatedAt: new Date() };
    const $unset = {};
    for (const f of MOVED_FIELDS) {
      if (b[f]) $set[f] = new mongoose.Types.ObjectId(b[f]);
      else $unset[f] = '';
    }
    const update = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;
    return { updateOne: { filter: { _id: new mongoose.Types.ObjectId(b._id) }, update } };
  });
  if (APPLY) {
    const res = await products.bulkWrite(ops, { ordered: false });
    console.log(`✅ Restored ${res.modifiedCount} products.`);
  }
}

async function main() {
  console.log(`🔌 Connecting to MongoDB${APPLY ? '' : ' (DRY RUN — nothing will be written)'}...`);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const products = db.collection('products');

  if (RESTORE_FILE) {
    await restore(products, RESTORE_FILE);
    return;
  }

  // 1. Target category + subcategory
  const category = await db.collection('categories').findOne({ slug: TARGET_CATEGORY_SLUG });
  if (!category) throw new Error(`Category "${TARGET_CATEGORY_SLUG}" not found`);
  const subcategory = await db
    .collection('subcategories')
    .findOne({ slug: TARGET_SUBCATEGORY_SLUG, category: category._id });
  if (!subcategory) throw new Error(`Subcategory "${TARGET_SUBCATEGORY_SLUG}" not found under ${TARGET_CATEGORY_SLUG}`);
  if (subcategory.isActive === false) {
    console.warn('⚠️  The target subcategory is marked inactive — it will stay hidden until re-enabled in admin.');
  }
  console.log(`🎯 Target: ${category.name} > ${subcategory.name}`);

  // 2. Find the products
  const legacy = readLegacyExport(TSV_PATH);
  console.log(`📄 ${legacy.length} products in ${TSV_PATH}`);

  const ids = legacy.map((r) => r.id);
  const found = await products
    .find({ legacyProductId: { $in: ids } })
    .project({ name: 1, legacyProductId: 1, legacySku: 1, ...Object.fromEntries(MOVED_FIELDS.map((f) => [f, 1])) })
    .toArray();
  const foundIds = new Set(found.map((p) => p.legacyProductId));

  // Fallback: match remaining ones by SKU
  const missing = legacy.filter((r) => !foundIds.has(r.id));
  const skus = missing.map((r) => r.sku).filter(Boolean);
  if (skus.length) {
    const bySku = await products
      .find({ legacySku: { $in: skus } })
      .project({ name: 1, legacyProductId: 1, legacySku: 1, ...Object.fromEntries(MOVED_FIELDS.map((f) => [f, 1])) })
      .toArray();
    const seen = new Set(found.map((p) => String(p._id)));
    for (const p of bySku) if (!seen.has(String(p._id))) found.push(p);
  }
  const matchedSkus = new Set(found.map((p) => p.legacySku));
  const notFound = missing.filter((r) => !r.sku || !matchedSkus.has(r.sku));

  console.log(`🔎 Matched ${found.length} products in MongoDB.`);
  if (notFound.length) {
    console.warn(`⚠️  ${notFound.length} not found on the new site:`);
    console.warn('   ' + notFound.slice(0, 50).map((r) => `${r.id}${r.sku ? ` (${r.sku})` : ''}`).join(', ') + (notFound.length > 50 ? ', …' : ''));
  }

  // 3. Report where they currently sit
  const subs = await db.collection('subcategories').find({}).project({ slug: 1 }).toArray();
  const cats = await db.collection('categories').find({}).project({ slug: 1 }).toArray();
  const subSlug = new Map(subs.map((s) => [String(s._id), s.slug]));
  const catSlug = new Map(cats.map((c) => [String(c._id), c.slug]));
  const where = new Map();
  for (const p of found) {
    const key = `${catSlug.get(String(p.category)) ?? '?'} > ${subSlug.get(String(p.subcategory)) ?? '(none)'}`;
    where.set(key, (where.get(key) ?? 0) + 1);
  }
  console.log('\n📍 Current location of matched products:');
  for (const [k, v] of [...where].sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(5)}  ${k}`);

  // 4. Decide what to move
  let toMove = found.filter(
    (p) => !(String(p.category) === String(category._id) && String(p.subcategory) === String(subcategory._id)),
  );
  const alreadyThere = found.length - toMove.length;
  if (KEEP_MORE_SPECIALS) {
    const before = toMove.length;
    toMove = toMove.filter((p) => subSlug.get(String(p.subcategory)) !== 'more-specials');
    console.log(`\n⏭️  --keep-more-specials: leaving ${before - toMove.length} products in Specials > More Specials.`);
  }
  console.log(`\n➡️  ${toMove.length} to move, ${alreadyThere} already in place.`);

  if (!APPLY) {
    console.log('\n🧪 Dry run complete. Re-run with --apply to make the changes.');
    return;
  }
  if (!toMove.length) return;

  // 5. Backup, then move
  fs.mkdirSync('backups', { recursive: true });
  const backupFile = path.join('backups', `precious-gems-move-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      toMove.map((p) => ({
        _id: String(p._id),
        legacyProductId: p.legacyProductId ?? null,
        ...Object.fromEntries(MOVED_FIELDS.map((f) => [f, p[f] ? String(p[f]) : null])),
      })),
      null,
      1,
    ),
  );
  console.log(`💾 Backup written: ${backupFile}`);

  const ops = toMove.map((p) => ({
    updateOne: {
      filter: { _id: p._id },
      update: {
        $set: { category: category._id, subcategory: subcategory._id, updatedAt: new Date() },
        // subSubcategory belongs to the old subcategory, so it no longer applies
        $unset: { subSubcategory: '' },
      },
    },
  }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await products.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    modified += res.modifiedCount;
  }

  const total = await products.countDocuments({ category: category._id, subcategory: subcategory._id });
  const active = await products.countDocuments({ category: category._id, subcategory: subcategory._id, isActive: true });
  console.log(`\n✅ Moved ${modified} products.`);
  console.log(`   ${category.name} > ${subcategory.name} now has ${total} products (${active} active).`);
  console.log(`   To undo: node scripts/move-to-precious-gems-deals.mjs --restore ${backupFile} --apply`);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
