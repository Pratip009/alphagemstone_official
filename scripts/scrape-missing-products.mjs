/**
 * Scrapes product listings from a fixed set of alphaimports.com
 * sub-subcategory pages — specifically the ones confirmed EMPTY on
 * alphagemstone.com (0 linked products) despite having real inventory on
 * the legacy site. See report-subsubcategory-counts.mjs for how those were
 * identified.
 *
 * This does NOT crawl the whole site — only the known-gap URLs below.
 * Pulls name / price / legacy product id / product URL from each listing
 * page (paginated, 18 products/page on that site), and writes everything
 * to a JSON file for review before importing.
 *
 * USAGE:
 *   node scripts/scrape-missing-products.mjs
 *   node scripts/scrape-missing-products.mjs --out scripts/output/scraped-products.json
 *
 * Output is an array of:
 *   { name, price, legacyProductId, url, category, subcategory, subSubcategory }
 *
 * Politeness: sequential requests with a delay between them, one page at a
 * time. This hits each category page plus its sub-pages (a few hundred
 * requests total depending on how many products each has) — expect this to
 * take a while, it is intentionally not parallelized.
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT_ARG_IDX = process.argv.indexOf('--out');
const OUT_PATH = OUT_ARG_IDX !== -1 ? process.argv[OUT_ARG_IDX + 1] : 'scripts/output/scraped-products.json';

const DELAY_MS = 600; // politeness delay between requests

// ── The confirmed gaps ───────────────────────────────────────────────────
// category / subcategory / subSubcategory here are the NAMES as they exist
// (or should exist) in your Mongo taxonomy — matched against them at import
// time, not written as-is.
//
// Silver Brooch removed: confirmed empty on the live site ("Products are
// coming soon"), not a scraping gap — nothing to scrape there.
const TARGETS = [
  {
    url: 'https://www.alphaimports.com/calibrated-tanzanite-c-22_30_244.html',
    category: 'Precious Gems', subcategory: 'Tanzanite', subSubcategory: 'Calibrated Tanzanite',
  },
  {
    url: 'https://www.alphaimports.com/emerald-cut-tanzanite-c-22_30_188.html',
    category: 'Precious Gems', subcategory: 'Tanzanite', subSubcategory: 'Emerald Cut Tanzanite',
  },
  {
    url: 'https://www.alphaimports.com/bridal-rings-c-24_144_180.html',
    category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', subSubcategory: 'Bridal Rings',
  },
  {
    url: 'https://www.alphaimports.com/right-hand-rings-c-24_144_182.html',
    category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings', subSubcategory: 'Right Hand Rings',
  },
  {
    url: 'https://www.alphaimports.com/tanzanite-earrings-c-24_279_280.html',
    category: 'Jewelry', subcategory: 'Tanzanite Jewelry', subSubcategory: 'Tanzanite Earrings',
  },
  {
    url: 'https://www.alphaimports.com/bridal-diamond-rings-c-24_126_202.html',
    category: 'Jewelry', subcategory: 'Diamond Rings', subSubcategory: 'Bridal Diamond Rings',
  },
  {
    url: 'https://www.alphaimports.com/diamond-earring-bargains-c-24_129_131.html',
    category: 'Jewelry', subcategory: 'Diamond Earrings', subSubcategory: 'Diamond Earring Bargains',
  },
  {
    url: 'https://www.alphaimports.com/diamondfashionpendants-c-24_132_294.html',
    category: 'Jewelry', subcategory: 'Diamond Pendants', subSubcategory: 'Diamond Fashion Pendants',
  },
  {
    url: 'https://www.alphaimports.com/cocktail-rings-c-24_135_277.html',
    category: 'Jewelry', subcategory: 'Gemstone Rings', subSubcategory: 'Cocktail Rings',
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; catalog-sync/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Total product count from "Displaying X to Y (of Z products)".
function extractTotalCount(html) {
  const m = html.match(/of\s*(?:<[^>]+>)?\s*(\d+)\s*(?:<[^>]+>)?\s*products/i);
  return m ? parseInt(m[1], 10) : null;
}

// Product detail links look like ...-p-12345.html (osCommerce/CRE Loaded
// style). Each product appears twice on a listing page (image link + text
// link) — dedupe by legacy product id.
function extractProducts(html, pageUrl) {
  // Pass 1: collect every product-link match with its position in the
  // document. Each product appears twice on a listing page (main grid +
  // repeating "New Products" sidebar) — dedupe by legacy product id below,
  // keeping the FIRST occurrence (the main grid one).
  const linkRe = /href="([^"]*-p-(\d+)\.html)"[^>]*>([^<]*)</g;
  const matches = [];
  let m;
  while ((m = linkRe.exec(html))) {
    const text = m[3].replace(/&amp;/g, '&').trim();
    if (!text) continue;
    matches.push({ index: m.index, hrefRaw: m[1], id: m[2], text });
  }

  // Pass 2: price extraction. Do NOT scan the whole page for $X.XX in
  // document order — every page also carries "$9.99 Specials / $24.99
  // Specials / $99.00 Specials" navbar links, whose literal $9.99/$24.99/
  // $99.00 text gets swept up first and shifts every real price 3 slots
  // onto the wrong product. Instead, scope each price lookup to the text
  // between THIS product's own link and the NEXT product link on the page
  // (capped at 800 chars) — the price sits right after each product's
  // name/link in this layout, so a local window is both simpler and
  // immune to unrelated $-amounts elsewhere on the page.
  const seen = new Map();
  matches.forEach((entry, i) => {
    if (seen.has(entry.id)) {
      const existing = seen.get(entry.id);
      if (entry.text.length > existing.name.length) existing.name = entry.text;
      return;
    }
    const href = entry.hrefRaw.startsWith('http') ? entry.hrefRaw : new URL(entry.hrefRaw, pageUrl).toString();
    const windowEnd = i + 1 < matches.length ? matches[i + 1].index : entry.index + 800;
    const windowText = html.slice(entry.index, Math.min(windowEnd, entry.index + 800));
    const priceMatch = windowText.match(/\$([\d,]+\.\d{2})/);
    seen.set(entry.id, {
      legacyProductId: entry.id,
      name: entry.text,
      url: href.split('?')[0],
      price: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null,
    });
  });

  return Array.from(seen.values());
}

async function scrapeCategory(target) {
  console.log(`\n📁 ${target.subSubcategory} — ${target.url}`);
  const firstPageHtml = await fetchHtml(target.url);
  const total = extractTotalCount(firstPageHtml);
  const pageSize = 12; // true grid size — raw pages show 18 because a
  // repeating "New Products" sidebar block adds 6 duplicate entries per
  // page; cross-page dedup below strips those back out
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  console.log(`   ${total ?? '?'} products reported, ${totalPages} page(s)`);

  const seenIds = new Set();
  const all = [];
  for (const p of extractProducts(firstPageHtml, target.url)) {
    seenIds.add(p.legacyProductId);
    all.push(p);
  }

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const pageUrl = `${target.url}?page=${page}`;
    try {
      const html = await fetchHtml(pageUrl);
      const found = extractProducts(html, pageUrl);
      const newOnes = found.filter((p) => !seenIds.has(p.legacyProductId));
      console.log(`   page ${page}: ${found.length} products (${newOnes.length} new)`);
      if (found.length > 0 && newOnes.length === 0) {
        console.log(`   ↳ page ${page} returned only already-seen products — past the real last page. Stopping.`);
        break;
      }
      for (const p of newOnes) {
        seenIds.add(p.legacyProductId);
        all.push(p);
      }
    } catch (err) {
      console.log(`   ⚠️  page ${page} failed: ${err.message}`);
    }
  }

  const withMeta = all.map((p) => ({
    ...p,
    category: target.category,
    subcategory: target.subcategory,
    subSubcategory: target.subSubcategory,
  }));

  console.log(`   ✓ ${withMeta.length} product(s) scraped for ${target.subSubcategory}`);
  if (total && withMeta.length < total * 0.8) {
    console.log(`   ⚠️  scraped count is well below the reported total (${total}) — the page structure may not match what this script expects. Spot-check the output.`);
  } else if (total && withMeta.length > total * 1.05) {
    console.log(`   ⚠️  scraped count (${withMeta.length}) exceeds the reported total (${total}) — dedup may still be incomplete. Spot-check the output.`);
  }
  return withMeta;
}

async function main() {
  const results = [];
  for (const target of TARGETS) {
    try {
      const products = await scrapeCategory(target);
      results.push(...products);
    } catch (err) {
      console.log(`❌ Failed to scrape ${target.subSubcategory}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));

  console.log('\n' + '─'.repeat(60));
  console.log(`Total products scraped: ${results.length}`);
  console.log(`Written to: ${OUT_PATH}`);
  console.log('\nReview the file, then run:');
  console.log(`  node scripts/import-scraped-products.mjs --file ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
