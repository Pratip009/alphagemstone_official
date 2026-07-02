import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  parseUploadedFile,
  generateCSVTemplate,
  deriveSlug,
} from "@/services/fileParser.service";
import { bulkCreateProducts } from "@/services/product.service";
import { withAdmin } from "@/middleware/auth.middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import Category from "@/models/Category";
import Subcategory from "@/models/Subcategory";

// ─── Build all match variants for a raw category/subcategory string ───────────
function buildSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const slug = deriveSlug(trimmed);

  const segments = trimmed
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
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

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // "true"/"false" string from a form checkbox — when on, categories that
    // don't resolve get created instead of dropping the row.
    const autoCreateCategories = formData.get("autoCreateCategories") === "true";

    if (!file) return errorResponse("No file uploaded", 400);

    const maxSize = 17 * 1024 * 1024;
    if (file.size > maxSize)
      return errorResponse("File too large (max 17MB)", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, parseErrors, warnings } = await parseUploadedFile(
      buffer,
      file.name,
    );

    if (rows.length === 0 && parseErrors.length > 0) {
      return errorResponse("No valid rows found in file", 400, {
        parseErrors,
      });
    }
    if (rows.length === 0) {
      return errorResponse("File appears to be empty", 400);
    }

    // ── Collect all unique raw category/subcategory values from parsed rows ───
    const rawCategoryValues = Array.from(
      new Set(
        rows.map((r) => r.category).filter((v): v is string => Boolean(v)),
      ),
    );
    const rawSubcategoryValues = Array.from(
      new Set(
        rows.map((r) => r.subcategory).filter((v): v is string => Boolean(v)),
      ),
    );

    const categorySearchVariants =
      rawCategoryValues.flatMap(buildSearchVariants);
    const subcategorySearchVariants =
      rawSubcategoryValues.flatMap(buildSearchVariants);

    const [categories, subcategories] = await Promise.all([
      Category.find({
        $or: [
          { slug: { $in: categorySearchVariants } },
          {
            name: {
              $in: categorySearchVariants.map(
                (v) => new RegExp(`^${escapeRegex(v)}$`, "i"),
              ),
            },
          },
        ],
      }).lean() as unknown as Array<{
        _id: { toString(): string };
        slug: string;
        name: string;
      }>,

      Subcategory.find({
        $or: [
          { slug: { $in: subcategorySearchVariants } },
          {
            name: {
              $in: subcategorySearchVariants.map(
                (v) => new RegExp(`^${escapeRegex(v)}$`, "i"),
              ),
            },
          },
        ],
      }).lean() as unknown as Array<{
        _id: { toString(): string };
        slug: string;
        name: string;
      }>,
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

    // ── Auto-create missing categories ──────────────────────────────────────
    // The previously-pending step: instead of just reporting a category as
    // missing and dropping every row that references it, create it (using
    // the raw name as-is, slugified) when the caller opts in.
    const createdCategories: string[] = [];
    if (autoCreateCategories) {
      for (const raw of rawCategoryValues) {
        const alreadyResolves = buildSearchVariants(raw).some(
          (v) => categoryMap.has(v) || categoryMap.has(v.toLowerCase()),
        );
        if (alreadyResolves) continue;

        const slug = deriveSlug(raw);
        if (!slug) continue;

        const created = await Category.create({ name: raw.trim(), slug });
        const id = created._id.toString();
        categoryMap.set(raw, id);
        categoryMap.set(raw.toLowerCase(), id);
        categoryMap.set(slug, id);
        createdCategories.push(raw);
      }
    }

    const resolvedRows: Record<string, unknown>[] = [];
    const resolutionErrors: Array<{ row: number; error: string }> = [];
    const missingSubcategories = new Set<string>();
    const missingCategories = new Set<string>();
    const subcategoriesDroppedButRowKept: Array<{
      row: number;
      subcategory: string;
    }> = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2; // row 1 = header, data starts at 2

      // ── Resolve category (required) ───────────────────────────────────────
      const categoryRaw = (row.category as string) ?? "";
      const categoryId = resolveId(categoryRaw, categoryMap);

      if (!categoryId) {
        missingCategories.add(categoryRaw);
        const tried = buildSearchVariants(categoryRaw).join('", "');
        resolutionErrors.push({
          row: rowNum,
          error: autoCreateCategories
            ? `Category "${categoryRaw}" could not be auto-created (empty/invalid name).`
            : `Category not found: "${categoryRaw}". Tried matching by slug/name: ["${tried}"]. Enable autoCreateCategories to create it automatically, or add it manually first.`,
        });
        return;
      }

      const resolvedRow: Record<string, unknown> = {
        ...row,
        category: categoryId,
      };

      // ── Resolve subcategory (optional) ────────────────────────────────────
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
          subcategoriesDroppedButRowKept.push({
            row: rowNum,
            subcategory: subcategoryRaw,
          });
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

    if (resolvedRows.length === 0) {
      return errorResponse(
        "No rows could be resolved — all rows had category/subcategory errors",
        400,
        { parseErrors, resolutionErrors },
      );
    }

    // ── Bulk insert ───────────────────────────────────────────────────────────
    const result = await bulkCreateProducts(resolvedRows);

    return successResponse({
      message: `Processed ${rows.length} row${rows.length !== 1 ? "s" : ""}`,
      inserted: result.inserted,
      failed: result.failed + parseErrors.length,
      errors: [...parseErrors, ...resolutionErrors, ...result.errors],
      warnings,
      createdCategories,
      missingCategories: Array.from(missingCategories),
      missingSubcategories: Array.from(missingSubcategories),
      subcategoriesDroppedButRowKept,
    });
  } catch (err) {
    console.error("[POST /api/admin/bulk-upload]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Bulk upload failed",
      500,
    );
  }
});

export const GET = withAdmin(async () => {
  const csv = generateCSVTemplate();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="products-template.csv"',
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveId(raw: string, map: Map<string, string>): string | undefined {
  for (const variant of buildSearchVariants(raw)) {
    const id = map.get(variant) ?? map.get(variant.toLowerCase());
    if (id) return id;
  }
  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}