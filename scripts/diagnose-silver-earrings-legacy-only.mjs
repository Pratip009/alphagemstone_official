/**
 * Follow-up to diagnose-silver-earrings-overlap.mjs.
 *
 * That script found: of 459 legacy "Silver Earrings" ids, 315 already
 * link to "Gemstone Silver Earrings" (fine), and 144 do NOT link there
 * (68.6% overlap — not the ~90%+ clean-relink pattern from Round 1/2).
 *
 * This script answers the open question for those 144 legacy-only ids:
 * are they already in the DB (just linked to some OTHER subSubcategory
 * — another relink bug, same pattern as everything else), or are they
 * genuinely absent from the DB (a real gap, first one in this project)?
 *
 * It re-scrapes the legacy Silver Earrings listing (same extraction as
 * before), recomputes the legacy-only set against Gemstone Silver
 * Earrings, then looks up EVERY one of those legacyProductIds against
 * the whole Product collection (no subSubcategory filter) and reports,
 * per id, either:
 *   - which subSubcategory it's currently linked to (relink candidate)
 *   - "no subSubcategory set" (never-linked, same as prior rounds)
 *   - "NOT FOUND IN DB" (genuine gap — needs actual scraping/import)
 *
 * Read-only. Writes nothing.
 *
 * USAGE:
 *   node scripts/diagnose-silver-earrings-legacy-only.mjs
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
const PAGE_SIZE = 12;

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
  return seen;
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
      if (found.size > 0 && newOnes.length === 0) break;
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
  console.log(`✓ ${legacyIds.size} distinct legacyProductId(s) found on the legacy Silver Earrings listing.\n`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const targetDoc = await SubSubcategory.findOne({
    name: new RegExp(`^${DB_TARGET_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();
  if (!targetDoc) {
    console.error(`❌ SubSubcategory "${DB_TARGET_NAME}" not found in DB.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const linkedToTarget = await Product.find({ subSubcategory: targetDoc._id })
    .select({ legacyProductId: 1 })
    .lean();
  const linkedToTargetIds = new Set(
    linkedToTarget.filter((p) => p.legacyProductId != null).map((p) => String(p.legacyProductId))
  );

  const legacyOnly = [...legacyIds.keys()].filter((id) => !linkedToTargetIds.has(id));
  console.log(`✓ ${legacyOnly.length} legacy-only id(s) to resolve.\n`);

  // Look these up against the WHOLE products collection, no category filter.
  const numericIds = legacyOnly.map((id) => Number(id)).filter((n) => !Number.isNaN(n));
  const matches = await Product.find({
    legacyProductId: { $in: [...legacyOnly, ...numericIds] },
  })
    .select({ legacyProductId: 1, name: 1, subSubcategory: 1 })
    .lean();

  const matchById = new Map(matches.map((p) => [String(p.legacyProductId), p]));

  // Resolve subSubcategory names in one batch.
  const subSubIds = [...new Set(matches.filter((p) => p.subSubcategory).map((p) => String(p.subSubcategory)))];
  const subSubDocs = await SubSubcategory.find({ _id: { $in: subSubIds } }).select({ name: 1 }).lean();
  const subSubNameById = new Map(subSubDocs.map((d) => [String(d._id), d.name]));

  const buckets = { linkedElsewhere: [], neverLinked: [], notFound: [] };

  for (const id of legacyOnly) {
    const name = legacyIds.get(id);
    const doc = matchById.get(id);
    if (!doc) {
      buckets.notFound.push({ id, name });
    } else if (doc.subSubcategory) {
      const subName = subSubNameById.get(String(doc.subSubcategory)) || String(doc.subSubcategory);
      buckets.linkedElsewhere.push({ id, name: doc.name || name, subName });
    } else {
      buckets.neverLinked.push({ id, name: doc.name || name });
    }
  }

  console.log('─'.repeat(70));
  console.log(`Legacy-only ids checked:         ${legacyOnly.length}`);
  console.log(`  → in DB, linked elsewhere:     ${buckets.linkedElsewhere.length}  (relink candidates)`);
  console.log(`  → in DB, never linked:         ${buckets.neverLinked.length}  (same pattern as prior rounds)`);
  console.log(`  → NOT in DB at all:            ${buckets.notFound.length}  (genuine gap, if any)`);

  if (buckets.linkedElsewhere.length) {
    console.log(`\nCurrently linked elsewhere — grouped by current subSubcategory:`);
    const grouped = {};
    for (const p of buckets.linkedElsewhere) {
      grouped[p.subName] = grouped[p.subName] || [];
      grouped[p.subName].push(p);
    }
    for (const [subName, items] of Object.entries(grouped)) {
      console.log(`   "${subName}": ${items.length} product(s)`);
      items.slice(0, 5).forEach((p) => console.log(`      [${p.id}] ${p.name}`));
      if (items.length > 5) console.log(`      ...and ${items.length - 5} more`);
    }
  }

  if (buckets.neverLinked.length) {
    console.log(`\nIn DB but never linked to any subSubcategory (first 15):`);
    buckets.neverLinked.slice(0, 15).forEach((p) => console.log(`   [${p.id}] ${p.name}`));
  }

  if (buckets.notFound.length) {
    console.log(`\n⚠️  Genuinely not in DB (first 15) — these are real candidates for scraping/import:`);
    buckets.notFound.slice(0, 15).forEach((p) => console.log(`   [${p.id}] ${p.name}`));
  } else {
    console.log(`\n✅ Every legacy-only id was found in the DB somewhere. Zero genuine gap — pure relink job.`);
  }

  console.log('\nRead-only — nothing written.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
