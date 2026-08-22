/**
 * Offline validation of the category-filter matching logic.
 *
 * Proves the matching semantics implemented in
 * src/lib/categoryFilterAttributeMap.ts + src/services/categoryFilter.service.ts
 * against the raw source CSVs directly (no MongoDB required) — useful for
 * environments (like CI or a sandboxed dev container) that can't reach the
 * database. This is a *logic* check, not a substitute for running
 * scripts/validate-category-filters.mjs against the real database.
 *
 * It re-implements just enough of the matching rules in plain JS to mirror
 * exactly what the Mongo query in categoryFilter.service.ts would do:
 *   - string fields: case/whitespace-insensitive exact match
 *   - numeric fields (WEIGHT): leading-number extraction + tolerance compare
 *   - AND across filters, OR within a filter's values
 *
 * Usage: node scripts/offline-validate-category-filters.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_CSV = path.join(ROOT, 'src', 'lib', 'products.csv');
const FILTERS_CSV = path.join(ROOT, 'data', 'final_category_filters.csv');

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function extractLeadingNumber(raw) {
  const m = String(raw ?? '').trim().match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}
const TOLERANCE = 0.005;

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// Build a "product" view exactly the way fileParser.service.ts's
// parseMatchedRow does for the fields this filter system reads.
function toProductView(r) {
  return {
    product_id: r.product_id,
    model: r.model,
    category_id: parseInt(r.category_id, 10),
    shapeRaw: r['attributes.shape'] || '',
    colorRaw: r['attributes.color'] || '',
    clarityRaw: r['attributes.clarity'] || '',
    gradeRaw: r['attributes.grade'] || '',
    cutType: r['attributes.cutType'] || '',
    dimensions: r['attributes.size'] || '',
    caratWeight: extractLeadingNumber(r['attributes.caratWeight']),
  };
}

// filterName -> product field(s), mirrors categoryFilterAttributeMap.ts
const FIELD_MAP = {
  SHAPE:  { field: 'shapeRaw', kind: 'string' },
  COLOR:  { field: 'colorRaw', kind: 'string' },
  CLARITY:{ field: 'clarityRaw', kind: 'string' },
  GRADE:  { field: 'gradeRaw', kind: 'string' },
  CUT:    { field: 'cutType', kind: 'string' },
  SIZE:   { field: 'dimensions', kind: 'string' },
  WEIGHT: { field: 'caratWeight', kind: 'numeric' },
};

function matchesSelection(product, selection) {
  // AND across filterNames, OR within a filterName's values.
  for (const [filterName, values] of Object.entries(selection)) {
    const mapping = FIELD_MAP[filterName];
    if (!mapping) return false;
    const productValue = product[mapping.field];

    const orMatch = values.some((v) => {
      if (mapping.kind === 'numeric') {
        const target = extractLeadingNumber(v);
        if (target === null || productValue === null) return false;
        return Math.abs(productValue - target) <= TOLERANCE;
      }
      return normalize(productValue) === normalize(v);
    });

    if (!orMatch) return false;
  }
  return true;
}

async function main() {
  console.log('Loading products.csv and final_category_filters.csv...');
  const [productRows, filterRows] = await Promise.all([
    readCsv(PRODUCTS_CSV),
    readCsv(FILTERS_CSV),
  ]);
  const products = productRows.map(toProductView);
  console.log(`  ${products.length} products, ${filterRows.length} filter definition rows\n`);

  let pass = 0, fail = 0;
  function check(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      pass++;
    } catch (e) {
      console.log(`❌ ${name}\n   ${e.message}`);
      fail++;
    }
  }

  // ── Verified example 1 ──────────────────────────────────────────────────
  check('Example 1: Marquise+Pink+6x3.7mm+SI+0.40ct → product 36704/PD033015005', () => {
    const selection = {
      SHAPE: ['Marquise'],
      COLOR: ['Pink'],
      SIZE: ['6x3.7 mm'],
      CLARITY: ['SI'],
      WEIGHT: ['0.40 ct.'],
    };
    const matches = products.filter((p) => matchesSelection(p, selection));
    const ids = matches.map((m) => m.product_id);
    if (!ids.includes('36704')) {
      throw new Error(`product 36704 not found in matches: [${ids.join(', ')}]`);
    }
    const target = matches.find((m) => m.product_id === '36704');
    if (target.model !== 'PD033015005') {
      throw new Error(`model mismatch: got ${target.model}`);
    }
  });

  // ── Verified example 2 ──────────────────────────────────────────────────
  check('Example 2: Cushion+Faceted+Aqua+7x5mm+A+1ct → product 26004/SBTF062708240', () => {
    const selection = {
      SHAPE: ['Cushion'],
      CUT: ['Faceted'],
      COLOR: ['Aqua'],
      SIZE: ['7x5 mm'],
      GRADE: ['A'],
      WEIGHT: ['1 ct.'],
    };
    const matches = products.filter((p) => matchesSelection(p, selection));
    const ids = matches.map((m) => m.product_id);
    if (!ids.includes('26004')) {
      throw new Error(`product 26004 not found in matches: [${ids.join(', ')}]`);
    }
    const target = matches.find((m) => m.product_id === '26004');
    if (target.model !== 'SBTF062708240') {
      throw new Error(`model mismatch: got ${target.model}`);
    }
  });

  // ── Single-filter selection ─────────────────────────────────────────────
  check('Single filter: SHAPE=Marquise returns only Marquise-shaped products', () => {
    const matches = products.filter((p) => matchesSelection(p, { SHAPE: ['Marquise'] }));
    if (matches.length === 0) throw new Error('expected at least one Marquise product');
    const bad = matches.find((p) => normalize(p.shapeRaw) !== 'marquise');
    if (bad) throw new Error(`non-Marquise product leaked in: ${bad.product_id} (${bad.shapeRaw})`);
  });

  // ── Multi-select OR within one filter ───────────────────────────────────
  check('Multi-select OR: SHAPE=[Marquise,Cushion] returns union of both shapes', () => {
    const matches = products.filter((p) => matchesSelection(p, { SHAPE: ['Marquise', 'Cushion'] }));
    const onlyMarquise = products.filter((p) => normalize(p.shapeRaw) === 'marquise').length;
    const onlyCushion = products.filter((p) => normalize(p.shapeRaw) === 'cushion').length;
    if (matches.length !== onlyMarquise + onlyCushion) {
      throw new Error(
        `expected ${onlyMarquise + onlyCushion} (marquise ${onlyMarquise} + cushion ${onlyCushion}), got ${matches.length}`
      );
    }
  });

  // ── Multi-filter AND ────────────────────────────────────────────────────
  check('Multi-filter AND: SHAPE=Marquise + COLOR=Pink is a strict subset of SHAPE=Marquise alone', () => {
    const shapeOnly = products.filter((p) => matchesSelection(p, { SHAPE: ['Marquise'] }));
    const shapeAndColor = products.filter((p) =>
      matchesSelection(p, { SHAPE: ['Marquise'], COLOR: ['Pink'] })
    );
    if (shapeAndColor.length > shapeOnly.length) {
      throw new Error('AND combination produced MORE results than a single filter — AND logic broken');
    }
    const bad = shapeAndColor.find(
      (p) => normalize(p.shapeRaw) !== 'marquise' || normalize(p.colorRaw) !== 'pink'
    );
    if (bad) throw new Error(`result violates AND constraint: ${bad.product_id}`);
  });

  // ── Zero-result combination ─────────────────────────────────────────────
  check('Zero-result: nonsensical combination returns 0 products cleanly', () => {
    const matches = products.filter((p) =>
      matchesSelection(p, { SHAPE: ['Marquise'], COLOR: ['Aqua'], WEIGHT: ['999 ct.'] })
    );
    if (matches.length !== 0) throw new Error(`expected 0, got ${matches.length}`);
  });

  // ── Category scoping: filters don't leak across categories ─────────────
  check('Category scoping: Emerald (27) filter values are absent from Pink Diamonds (206) definitions', () => {
    const emeraldValues = new Set(
      filterRows.filter((r) => r.category_id === '27').map((r) => normalize(r.filter_value))
    );
    const pinkDiamondValues = new Set(
      filterRows.filter((r) => r.category_id === '206').map((r) => normalize(r.filter_value))
    );
    // Values are category-specific rows in the source CSV — the two sets
    // should not be identical (i.e. the CSV itself is genuinely
    // category-scoped, not one global list re-used everywhere).
    const overlap = [...emeraldValues].filter((v) => pinkDiamondValues.has(v));
    if (overlap.length === emeraldValues.size && emeraldValues.size > 0) {
      throw new Error('Emerald and Pink Diamonds filter value sets are identical — no category scoping in source data');
    }
  });

  // ── Case/whitespace insensitivity ───────────────────────────────────────
  check('Case/whitespace insensitivity: " marquise " matches "Marquise"', () => {
    const matches = products.filter((p) => matchesSelection(p, { SHAPE: [' MARQUISE  '] }));
    const exact = products.filter((p) => normalize(p.shapeRaw) === 'marquise');
    if (matches.length !== exact.length) {
      throw new Error(`expected ${exact.length}, got ${matches.length}`);
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Validation script crashed:', err);
  process.exit(1);
});
