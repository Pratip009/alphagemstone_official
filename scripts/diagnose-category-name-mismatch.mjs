// scripts/diagnose-category-name-mismatch.mjs
// Read-only diagnostic. Lists the real Subcategory/Category names in the DB
// side-by-side with the category_name values from final_category_filters.csv
// that import-category-filters.mjs could NOT match, so we can see the exact
// naming pattern and fix the matcher (or the CSV) accordingly.
//
// Usage: node scripts/diagnose-category-name-mismatch.mjs
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'data', 'final_category_filters.csv');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

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

const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false, collection: 'categories' }));
const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false, collection: 'subcategories' }));

await mongoose.connect(MONGODB_URI);

const rows = await readCsv(CSV_PATH);
const csvNames = Array.from(new Set(rows.map((r) => normalize(r.category_name)).filter(Boolean))).sort();

const subcats = await Subcategory.find({}).select('name slug category').lean();
const cats = await Category.find({}).select('name slug').lean();

const subcatNames = new Set(subcats.map((s) => normalize(s.name)));
const catNames = new Set(cats.map((c) => normalize(c.name)));

const matched = [];
const unmatched = [];
for (const name of csvNames) {
  if (subcatNames.has(name) || catNames.has(name)) matched.push(name);
  else unmatched.push(name);
}

console.log(`\nCSV has ${csvNames.length} distinct category_name values.`);
console.log(`Matched: ${matched.length}   Unmatched: ${unmatched.length}\n`);

console.log('--- Real Subcategory names in DB (' + subcats.length + ') ---');
subcats.forEach((s) => console.log('  ', s.name, ' | slug:', s.slug));

console.log('\n--- Real Category names in DB (' + cats.length + ') ---');
cats.forEach((c) => console.log('  ', c.name, ' | slug:', c.slug));

console.log('\n--- Unmatched CSV category_name values ---');
unmatched.forEach((n) => console.log('  ', n));

await mongoose.disconnect();
