/**
 * Scans every model/field that references an image URL (same field map as
 * migrate-cloudinary-to-r2.mjs) and reports how many distinct image URLs
 * exist vs. how many times each one is referenced — i.e. how many images
 * are unique vs. reused across documents/models.
 *
 * Read-only: never writes to Mongo, Cloudinary, or R2.
 *
 * REQUIRED ENV VARS (.env.local or .env)
 * ────────────────────────────────────────
 *   MONGODB_URI
 *
 * USAGE
 * ─────
 *   node scripts/check-image-usage.mjs
 *
 *   Only Cloudinary URLs (e.g. to see what's left to migrate):
 *     node scripts/check-image-usage.mjs --host cloudinary
 *
 *   Only R2 URLs (e.g. to sanity-check the migration afterwards):
 *     node scripts/check-image-usage.mjs --host r2
 *
 *   Show every reused URL instead of just the top 20:
 *     node scripts/check-image-usage.mjs --all-duplicates
 *
 *   Write the full per-URL breakdown to a JSON file:
 *     node scripts/check-image-usage.mjs --out image-usage-report.json
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';
import { writeFile } from 'fs/promises';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const hostFilter = getArg('host'); // 'cloudinary' | 'r2' | undefined (all)
const showAllDuplicates = Boolean(getArg('all-duplicates', false));
const outPath = getArg('out');
const topN = showAllDuplicates ? Infinity : 20;

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error('❌ Missing env var: MONGODB_URI');
  process.exit(1);
}

function matchesHostFilter(url) {
  if (!hostFilter) return true;
  if (hostFilter === 'cloudinary') return url.includes('res.cloudinary.com');
  if (hostFilter === 'r2') return url.includes('.r2.dev') || url.includes('r2.cloudflarestorage.com') || !url.includes('res.cloudinary.com');
  return true;
}

// Same schemas as the migration script — strict:false so we can read
// whatever fields already exist without redefining the full app schema.
const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }));
const HeroSlide = mongoose.models.HeroSlide || mongoose.model('HeroSlide', new mongoose.Schema({}, { strict: false }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Memo = mongoose.models.Memo || mongoose.model('Memo', new mongoose.Schema({}, { strict: false }));
const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const NewsletterCampaign =
  mongoose.models.NewsletterCampaign || mongoose.model('NewsletterCampaign', new mongoose.Schema({}, { strict: false }));

// Same field map as migrate-cloudinary-to-r2.mjs's extractUrls(), so a URL
// counted here as "referenced by 3 docs" is the same URL that script would
// only ever migrate once.
const SOURCES = [
  { key: 'product', label: 'Product.images[]', Model: Product, extractUrls: (doc) => doc.images || [] },
  { key: 'subcategory', label: 'Subcategory.imageUrl', Model: Subcategory, extractUrls: (doc) => [doc.imageUrl] },
  {
    key: 'hero',
    label: 'HeroSlide.desktopImage/mobileImage',
    Model: HeroSlide,
    extractUrls: (doc) => [doc.desktopImage, doc.mobileImage],
  },
  { key: 'avatar', label: 'User.avatarUrl', Model: User, extractUrls: (doc) => [doc.avatarUrl] },
  { key: 'memo', label: 'Memo.image', Model: Memo, extractUrls: (doc) => [doc.image] },
  { key: 'order', label: 'Order.image', Model: Order, extractUrls: (doc) => [doc.image] },
  { key: 'newsletter', label: 'NewsletterCampaign.image', Model: NewsletterCampaign, extractUrls: (doc) => [doc.image] },
];

async function main() {
  console.log('🔎 Scanning image references across all models' + (hostFilter ? ` (host filter: ${hostFilter})` : '') + '...\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // url -> { count, models: Set<string>, docIds: [{model, docId}] }
  const usage = new Map();
  const perModelStats = [];

  for (const { key, label, Model, extractUrls } of SOURCES) {
    // Only project the fields we actually read, keeps this cheap even on
    // large collections.
    const projection = { _id: 1 };
    for (const f of ['images', 'imageUrl', 'desktopImage', 'mobileImage', 'avatarUrl', 'image']) {
      projection[f] = 1;
    }

    const cursor = Model.find({}, projection).lean().cursor();
    let docsScanned = 0;
    let refsInModel = 0;

    for await (const doc of cursor) {
      docsScanned++;
      const urls = extractUrls(doc).filter((u) => typeof u === 'string' && u.length > 0 && matchesHostFilter(u));
      for (const url of urls) {
        refsInModel++;
        let entry = usage.get(url);
        if (!entry) {
          entry = { count: 0, models: new Set(), docIds: [] };
          usage.set(url, entry);
        }
        entry.count++;
        entry.models.add(key);
        entry.docIds.push({ model: key, docId: String(doc._id) });
      }
    }

    perModelStats.push({ key, label, docsScanned, refs: refsInModel });
    console.log(`   ${label}: ${docsScanned} doc(s) scanned, ${refsInModel} image reference(s)`);
  }

  await mongoose.disconnect();

  const totalRefs = [...usage.values()].reduce((sum, e) => sum + e.count, 0);
  const uniqueUrls = usage.size;
  const reusedEntries = [...usage.entries()].filter(([, e]) => e.count > 1);
  const uniqueOnlyCount = uniqueUrls - reusedEntries.length;
  const wastedRefs = totalRefs - uniqueUrls; // references beyond the "first" one for each URL

  console.log('\n' + '─'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('─'.repeat(60));
  console.log(`   Total image references scanned : ${totalRefs}`);
  console.log(`   Unique image URLs               : ${uniqueUrls}`);
  console.log(`     • referenced exactly once     : ${uniqueOnlyCount}`);
  console.log(`     • reused (referenced 2+ times) : ${reusedEntries.length}`);
  console.log(`   "Extra" references beyond 1st   : ${wastedRefs} (these are what a migration script's per-URL cache saves you from re-uploading)`);

  console.log('\n📁 Per-model breakdown:');
  for (const s of perModelStats) {
    console.log(`   ${s.label.padEnd(35)} ${String(s.docsScanned).padStart(5)} docs   ${String(s.refs).padStart(5)} refs`);
  }

  if (reusedEntries.length > 0) {
    reusedEntries.sort((a, b) => b[1].count - a[1].count);
    const shown = showAllDuplicates ? reusedEntries : reusedEntries.slice(0, topN);
    console.log(`\n🔁 ${showAllDuplicates ? 'All' : `Top ${shown.length} of ${reusedEntries.length}`} reused image(s):`);
    for (const [url, entry] of shown) {
      const modelsList = [...entry.models].join(', ');
      console.log(`   ${String(entry.count).padStart(3)}x  [${modelsList}]  ${url}`);
    }
    if (!showAllDuplicates && reusedEntries.length > topN) {
      console.log(`   ... and ${reusedEntries.length - topN} more (pass --all-duplicates to see all, or --out to export everything)`);
    }
  } else {
    console.log('\n🔁 No reused images found — every URL is referenced exactly once.');
  }

  if (outPath) {
    const report = {
      generatedAt: new Date().toISOString(),
      hostFilter: hostFilter || null,
      totalRefs,
      uniqueUrls,
      uniqueOnlyCount,
      reusedCount: reusedEntries.length,
      wastedRefs,
      perModel: perModelStats,
      duplicates: reusedEntries.map(([url, entry]) => ({
        url,
        count: entry.count,
        models: [...entry.models],
        references: entry.docIds,
      })),
    };
    await writeFile(outPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report written to ${outPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n❌ Script failed:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
