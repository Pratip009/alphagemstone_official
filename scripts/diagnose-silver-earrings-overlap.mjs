/**
 * Read-only check for the Silver Earrings vs. Gemstone Silver Earrings
 * question flagged in scrape-missing-products.mjs:
 *
 *   Silver Jewelry > Silver Earrings (legacy c-24_271_274, reports 459
 *   products) has on-page description text identical to the sibling
 *   "Gemstone Silver Earrings" subSubcategory, which already has 480
 *   products in the DB. Before scraping Silver Earrings as if it were a
 *   genuine gap, diff its legacy legacyProductIds against what's already
 *   linked to Gemstone Silver Earrings in the DB.
 *
 * This does NOT write anything and does NOT scrape full product data —
 * it only paginates the legacy listing page to collect legacyProductIds
 * (same extraction pattern as scrape-missing-products.mjs), then compares
 * that id set against Product.find({ subSubcategory: <Gemstone Silver
 * Earrings _id> }).legacyProductId.
 *
 * Possible outcomes:
 *   - Near-total overlap  -> confirms hypothesis: Silver Earrings is not
 *     a real gap, it's the same products already linked under Gemstone
 *     Silver Earrings. This becomes a relink job like everything else.
 *   - Low/no overlap      -> Silver Earrings is a genuine separate set;
 *     treat it like Round 2 (scrape + relink-by-legacyProductId, or
 *     import for real if it turns out truly new).
 *   - Partial overlap     -> most likely case; report tells you exactly
 *     how many ids are shared vs. legacy-only vs. DB-only so the next
 *     step can be scoped precisely.
 *
 * USAGE:
 *   node scripts/diagnose-silver-earrings-overlap.mjs
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

const LEGACY_URL = 'https://www.alphaimports.com/silver-earrings-c-24_271_274.html';
const DB_TARGET_NAME = 'Gemstone Silver Earrings';
const DELAY_MS = 600;
const FETCH_RETRIES = 3;
const PAGE_SIZE = 12; // true grid size, per scrape-missing-products.mjs

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; catalog-sync/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } catch (err) {
    if (attempt >= FETCH_RETRIES) throw err;
    const backoffMs = 1000 * attempt;
    console.log(`   ↳ retry ${attempt}/${FETCH_RETRIES - 1} for ${url} after ${err.message} (waiting ${backoffMs}ms)`);
    await sleep(backoffMs);
    return fetchHtml(url, attempt + 1);
  }
}

function extractTotalCount(html) {
  const m = html.match(/of\s*(?:<[^>]+>)?\s*(\d+)\s*(?:<[^>]+>)?\s*products/i);
  return m ? parseInt(m[1], 10) : null;
}

// Same dedupe-by-id pattern as scrape-missing-products.mjs, but we only
// need the id + name here, not price.
function extractProductIds(html) {
  const linkRe = /href="([^"]*-p-(\d+)\.html)"[^>]*>([^<]*)</g;
  const seen = new Map();
  let m;
  while ((m = linkRe.exec(html))) {
    const text = m[3].replace(/&amp;/g, '&').trim();
    if (!text) continue;
    const id = m[2];
    if (!seen.has(id)) seen.set(id, text);
  }
  return seen; // id -> name
}

async function scrapeLegacyIds(url) {
  console.log(`📁 Fetching legacy listing: ${url}`);
  const firstPageHtml = await fetchHtml(url);
  const total = extractTotalCount(firstPageHtml);
  const totalPages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  console.log(`   ${total ?? '?'} products reported, ${totalPages} page(s)\n`);

  const all = new Map(extractProductIds(firstPageHtml));

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const pageUrl = `${url}?page=${page}`;
    try {
      const html = await fetchHtml(pageUrl);
      const found = extractProductIds(html);
      const newOnes = [...found.entries()].filter(([id]) => !all.has(id));
      console.log(`   page ${page}: ${found.size} products (${newOnes.length} new)`);
      if (found.size > 0 && newOnes.length === 0) {
        console.log(`   ↳ page ${page} returned only already-seen products — stopping.`);
        break;
      }
      for (const [id, name] of newOnes) all.set(id, name);
    } catch (err) {
      console.log(`   ⚠️  page ${page} failed: ${err.message}`);
    }
  }

  return all;
}

async function main() {
  const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
  const ProductSchema = new mongoose.Schema({}, { strict: false });
  const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
  const Product = mongoose.model('Product', ProductSchema, 'products');

  const legacyIds = await scrapeLegacyIds(LEGACY_URL);
  console.log(`\n✓ ${legacyIds.size} distinct legacyProductId(s) found on the legacy Silver Earrings listing.\n`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const targetDoc = await SubSubcategory.findOne({
    name: new RegExp(`^${DB_TARGET_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();

  if (!targetDoc) {
    console.error(`❌ SubSubcategory "${DB_TARGET_NAME}" not found in DB — cannot compare.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const dbProducts = await Product.find({ subSubcategory: targetDoc._id })
    .select({ legacyProductId: 1, name: 1 })
    .lean();
  const dbIds = new Map(
    dbProducts
      .filter((p) => p.legacyProductId != null)
      .map((p) => [String(p.legacyProductId), p.name])
  );

  console.log(`✓ ${dbIds.size} of ${dbProducts.length} products currently linked to "${DB_TARGET_NAME}" have a legacyProductId.\n`);

  const overlap = [...legacyIds.keys()].filter((id) => dbIds.has(id));
  const legacyOnly = [...legacyIds.keys()].filter((id) => !dbIds.has(id));
  const dbOnly = [...dbIds.keys()].filter((id) => !legacyIds.has(id));

  console.log('─'.repeat(60));
  console.log(`Legacy "Silver Earrings" ids:          ${legacyIds.size}`);
  console.log(`DB "${DB_TARGET_NAME}" ids:  ${dbIds.size}`);
  console.log(`Overlap (same product, both sides):    ${overlap.length}`);
  console.log(`Legacy-only (not in ${DB_TARGET_NAME}): ${legacyOnly.length}`);
  console.log(`DB-only (in ${DB_TARGET_NAME} but not on legacy Silver Earrings page): ${dbOnly.length}`);

  const overlapPct = legacyIds.size ? ((overlap.length / legacyIds.size) * 100).toFixed(1) : '0.0';
  console.log(`\nOverlap = ${overlapPct}% of legacy Silver Earrings ids.`);

  if (legacyOnly.length > 0) {
    console.log(`\nFirst ${Math.min(15, legacyOnly.length)} legacy-only id(s) (candidates for a genuine relink target, or true gap):`);
    legacyOnly.slice(0, 15).forEach((id) => console.log(`   [${id}] ${legacyIds.get(id)}`));
  }

  console.log('\nThis was read-only — nothing was written. Use the overlap % to decide:');
  console.log('  > ~90%+ overlap  -> confirmed relink case, same pattern as Round 1/2.');
  console.log('  < that           -> investigate legacy-only ids before assuming it\'s pure relink.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});