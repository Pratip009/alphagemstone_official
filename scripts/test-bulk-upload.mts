/**
 * test-bulk-upload.mts
 * ─────────────────────────────────────────────────────────────────────────
 * DRY-RUN, READ-ONLY simulation of POST /api/admin/bulk-upload.
 *
 * Safe to run against your real, live database with existing products still
 * in it. It only ever calls .find() / .countDocuments() / in-memory
 * .validateSync() — it NEVER calls insertMany, Category.create,
 * updateOne, deleteOne, or anything else that writes.
 *
 * Every write the real route performs (bulkCreateProducts, category
 * auto-create) is reproduced here as a pure computation: it works out what
 * WOULD happen and reports it, without ever calling the mutating function.
 *
 * Usage:
 *   npx tsx scripts/test-bulk-upload.mts /path/to/file.csv
 *   npx tsx scripts/test-bulk-upload.mts /path/to/file.csv --auto-create
 *
 * Requires MONGODB_URI to already be set (reads from .env.local, same as
 * the app does) — nothing new to configure.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { parseUploadedFile, deriveSlug } from "../src/services/fileParser.service";
import Product from "../src/models/Product";
import Category from "../src/models/Category";
import Subcategory from "../src/models/Subcategory";

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filePathArg = args.find((a) => !a.startsWith("--"));
const autoCreateCategories = args.includes("--auto-create");

if (!filePathArg) {
  console.error("Usage: npx tsx scripts/test-bulk-upload.mts <file.csv> [--auto-create]");
  process.exit(1);
}

const filePath = path.resolve(filePathArg);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// ─── Copied verbatim from the real route (kept in sync manually) ──────────
function buildSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const slug = deriveSlug(trimmed);
  const segments = trimmed.split(">").map((s) => s.trim()).filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? trimmed;
  return Array.from(new Set([trimmed, slug, lastSegment])).filter(Boolean);
}

const IGNORE_SUBCATEGORIES = [
  "Certificates",
  "Diamond Loupe",
  "Diamond Deals and Steals",
  "Diamond Earring Bargains",
  "Alpha Collector's Gallery",
  "nan",
];

const SUBCATEGORY_MAPPING: Record<string, string> = {
  "Blue Sapphire": "Sapphire",
  "Yellow Sapphire": "Sapphire",
  "Pink Sapphire": "Sapphire",
  "Orange Sapphire": "Sapphire",
  "White Sapphire": "Sapphire",
  "Green Sapphire": "Sapphire",
  "Multicolor Sapphire": "Sapphire",
  "Cabochon Ruby": "Ruby",
  "Faceted Ruby": "Ruby",
  "Cabochon Garnet": "Garnet",
  "Calibrated Tanzanite": "Tanzanite",
  "Pear tanzanite": "Tanzanite",
  "Cushion tanzanite": "Tanzanite",
  "Ruby Diamond Rings": "Gemstone Rings",
  "Sapphire Diamond Rings": "Gemstone Rings",
  "Tanzanite Diamond Rings": "Gemstone Rings",
  "Three Stone Diamond Rings": "Diamond Rings",
  "3 Stone Diamond Pendants": "Diamond Pendants",
  "Silver Solitaire Rings": "Solitaire Rings",
  "Silver Solitaire Pendants": "Solitaire Pendants",
  "Cocktail Rings": "Gemstone Rings",
  "Solitaire Rings With Gemstones": "Gemstone Rings",
  "Diamond Stud Earrings (In Silver": "Diamond Stud Earrings",
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveId(raw: string, map: Map<string, string>): string | undefined {
  for (const variant of buildSearchVariants(raw)) {
    const id = map.get(variant) ?? map.get(variant.toLowerCase());
    if (id) return id;
  }
  return undefined;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set (expected in .env.local). Aborting.");
    process.exit(1);
  }

  console.log(`\nConnecting to database (read-only usage)...`);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected.\n");

  try {
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    console.log(`Parsing ${filename}...`);
    const { rows, parseErrors, warnings } = await parseUploadedFile(buffer, filename);
    console.log(`  → ${rows.length} row(s) parsed, ${parseErrors.length} parse error(s), ${warnings.length} warning(s)\n`);

    if (rows.length === 0) {
      console.log("No valid rows found — nothing further to simulate.");
      if (parseErrors.length) console.log(parseErrors.slice(0, 20));
      return;
    }

    // ── Existing DB state (read-only) ─────────────────────────────────────
    const existingProductCount = await Product.countDocuments();
    console.log(`Existing products in DB: ${existingProductCount} (will NOT be touched)\n`);

    const rawCategoryValues = Array.from(
      new Set(rows.map((r) => r.category).filter((v): v is string => Boolean(v))),
    );
    const rawSubcategoryValues = Array.from(
      new Set(rows.map((r) => r.subcategory).filter((v): v is string => Boolean(v))),
    );

    const categorySearchVariants = rawCategoryValues.flatMap(buildSearchVariants);
    const subcategorySearchVariants = rawSubcategoryValues.flatMap(buildSearchVariants);

    const [categories, subcategories] = await Promise.all([
      Category.find({
        $or: [
          { slug: { $in: categorySearchVariants } },
          { name: { $in: categorySearchVariants.map((v) => new RegExp(`^${escapeRegex(v)}$`, "i")) } },
        ],
      }).lean() as unknown as Promise<Array<{ _id: { toString(): string }; slug: string; name: string }>>,
      Subcategory.find({
        $or: [
          { slug: { $in: subcategorySearchVariants } },
          { name: { $in: subcategorySearchVariants.map((v) => new RegExp(`^${escapeRegex(v)}$`, "i")) } },
        ],
      }).lean() as unknown as Promise<Array<{ _id: { toString(): string }; slug: string; name: string }>>,
    ]);

    const categoryMap = new Map<string, string>();
    for (const c of categories) {
      categoryMap.set(c.slug, c._id.toString());
      categoryMap.set(c.slug.toLowerCase(), c._id.toString());
      categoryMap.set(c.name, c._id.toString());
      categoryMap.set(c.name.toLowerCase(), c._id.toString());
    }

    const subcategoryMap = new Map<string, string>();
    for (const s of subcategories) {
      subcategoryMap.set(s.slug, s._id.toString());
      subcategoryMap.set(s.slug.toLowerCase(), s._id.toString());
      subcategoryMap.set(s.name, s._id.toString());
      subcategoryMap.set(s.name.toLowerCase(), s._id.toString());
    }

    // ── SIMULATED auto-create (no Category.create call — just tracked) ─────
    const wouldCreateCategories: string[] = [];
    if (autoCreateCategories) {
      for (const raw of rawCategoryValues) {
        const alreadyResolves = buildSearchVariants(raw).some(
          (v) => categoryMap.has(v) || categoryMap.has(v.toLowerCase()),
        );
        if (alreadyResolves) continue;
        const slug = deriveSlug(raw);
        if (!slug) continue;
        // Simulate the id that WOULD be assigned — no DB write happens.
        const fakeId = new mongoose.Types.ObjectId().toString();
        categoryMap.set(raw, fakeId);
        categoryMap.set(raw.toLowerCase(), fakeId);
        categoryMap.set(slug, fakeId);
        wouldCreateCategories.push(raw);
      }
    }

    // ── Row resolution (mirrors the route's logic, no writes) ──────────────
    const resolvedRows: Record<string, unknown>[] = [];
    const resolutionErrors: Array<{ row: number; error: string }> = [];
    const missingSubcategories = new Set<string>();
    const missingCategories = new Set<string>();
    const subcategoriesDroppedButRowKept: Array<{ row: number; subcategory: string }> = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const categoryRaw = (row.category as string) ?? "";
      const categoryId = resolveId(categoryRaw, categoryMap);

      if (!categoryId) {
        missingCategories.add(categoryRaw);
        resolutionErrors.push({
          row: rowNum,
          error: autoCreateCategories
            ? `Category "${categoryRaw}" could not be auto-created (empty/invalid name).`
            : `Category not found: "${categoryRaw}". Enable --auto-create to simulate creating it, or add it manually first.`,
        });
        return;
      }

      const resolvedRow: Record<string, unknown> = { ...row, category: categoryId };

      if (row.subcategory) {
        let subcategoryRaw = row.subcategory as string;

        if (IGNORE_SUBCATEGORIES.includes(subcategoryRaw)) {
          delete resolvedRow.subcategory;
          resolvedRows.push(resolvedRow);
          return;
        }
        if (SUBCATEGORY_MAPPING[subcategoryRaw]) {
          subcategoryRaw = SUBCATEGORY_MAPPING[subcategoryRaw];
        }

        const subcategoryId = resolveId(subcategoryRaw, subcategoryMap);
        if (!subcategoryId) {
          missingSubcategories.add(subcategoryRaw);
          subcategoriesDroppedButRowKept.push({ row: rowNum, subcategory: subcategoryRaw });
          delete resolvedRow.subcategory;
          resolvedRows.push(resolvedRow);
          return;
        }
        resolvedRow.subcategory = subcategoryId;
      } else {
        delete resolvedRow.subcategory;
      }

      resolvedRows.push(resolvedRow);
    });

    // ── Schema validation only — validateSync, never save/insertMany ───────
    let validCount = 0;
    const validationErrors: Array<{ row: number; error: string }> = [];
    resolvedRows.forEach((row, idx) => {
      const rowNum = idx + 2; // approximate; resolvedRows already dropped some
      const doc = new Product(row);
      const err = doc.validateSync();
      if (err) {
        validationErrors.push({ row: rowNum, error: err.message });
      } else {
        validCount++;
      }
    });

    // ── legacyProductId collision check (the one real unique index) ────────
    const legacyIds = resolvedRows
      .map((r) => (r as Record<string, unknown>).legacyProductId)
      .filter((v): v is number => typeof v === "number");
    let collisionCount = 0;
    const sampleCollisions: number[] = [];
    if (legacyIds.length) {
      const existing = await Product.find({ legacyProductId: { $in: legacyIds } })
        .select("legacyProductId")
        .lean();
      const existingSet = new Set(existing.map((e: any) => e.legacyProductId));
      for (const id of legacyIds) {
        if (existingSet.has(id)) {
          collisionCount++;
          if (sampleCollisions.length < 10) sampleCollisions.push(id);
        }
      }
    }

    // ── Report ───────────────────────────────────────────────────────────
    console.log("═".repeat(70));
    console.log("DRY-RUN SUMMARY — nothing was written to the database");
    console.log("═".repeat(70));
    console.log(`Rows parsed:                 ${rows.length}`);
    console.log(`Parse errors:                ${parseErrors.length}`);
    console.log(`Rows with resolvable category: ${resolvedRows.length}`);
    console.log(`Rows dropped (missing category): ${resolutionErrors.length}`);
    console.log(`Schema-valid rows:            ${validCount}`);
    console.log(`Schema-invalid rows:          ${validationErrors.length}`);
    console.log(`legacyProductId collisions with existing products: ${collisionCount}`);
    console.log("");
    console.log(`Estimated rows that WOULD insert successfully: ${validCount - collisionCount}`);
    console.log("═".repeat(70));

    console.log(`\nCategories matched in DB: ${categories.length} / ${rawCategoryValues.length} unique raw values`);
    console.log(`Subcategories matched in DB: ${subcategories.length} / ${rawSubcategoryValues.length} unique raw values`);

    if (missingCategories.size) {
      console.log(`\nMissing categories (${missingCategories.size}):`);
      console.log([...missingCategories].slice(0, 30).map((c) => `  - "${c}"`).join("\n"));
    }
    if (autoCreateCategories && wouldCreateCategories.length) {
      console.log(`\nCategories that WOULD be auto-created (${wouldCreateCategories.length}):`);
      console.log(wouldCreateCategories.slice(0, 30).map((c) => `  - "${c}"`).join("\n"));
    }
    if (missingSubcategories.size) {
      console.log(`\nMissing subcategories (dropped, row kept) (${missingSubcategories.size}):`);
      console.log([...missingSubcategories].slice(0, 30).map((c) => `  - "${c}"`).join("\n"));
    }
    if (collisionCount) {
      console.log(`\nSample colliding legacyProductId values: ${sampleCollisions.join(", ")}`);
    }
    if (validationErrors.length) {
      console.log(`\nFirst ${Math.min(10, validationErrors.length)} schema validation errors:`);
      validationErrors.slice(0, 10).forEach((e) => console.log(`  row ${e.row}: ${e.error}`));
    }
    if (parseErrors.length) {
      console.log(`\nFirst ${Math.min(10, parseErrors.length)} parse errors:`);
      parseErrors.slice(0, 10).forEach((e) => console.log(`  row ${e.row}: ${e.error}`));
    }

    console.log("\nDone. No products, categories, or subcategories were created, modified, or deleted.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error during dry run:", err);
  process.exitCode = 1;
});