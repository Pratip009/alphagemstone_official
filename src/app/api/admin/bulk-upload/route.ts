import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { parseUploadedFile, generateCSVTemplate, deriveSlug } from '@/services/fileParser.service';
import { bulkCreateProducts } from '@/services/product.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import Category from '@/models/Category';
import Subcategory from '@/models/Subcategory';

// ─── Build all match variants for a raw category/subcategory string ───────────
// The user may type any of:
//   - A slug:             "loose-diamonds"
//   - A display name:     "Loose Diamonds"
//   - A breadcrumb path:  "Diamonds > Natural Diamonds > Loose Diamonds"
//
// For each raw value we produce:
//   1. The raw value itself (matches slug if user typed a slug)
//   2. deriveSlug(raw)   (slug of the last breadcrumb segment)
//   3. The last breadcrumb segment, trimmed (matches name if user typed display name)
function buildSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const slug = deriveSlug(trimmed);

  // Last segment of a ">" path (e.g. "Loose Diamonds" from "X > Y > Loose Diamonds")
  const segments = trimmed.split('>').map((s) => s.trim()).filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? trimmed;

  // Deduplicate
  return Array.from(new Set([trimmed, slug, lastSegment])).filter(Boolean);
}

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return errorResponse('No file uploaded', 400);

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) return errorResponse('File too large (max 10MB)', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, parseErrors } = await parseUploadedFile(buffer, file.name);

    if (rows.length === 0 && parseErrors.length > 0) {
      return errorResponse('No valid rows found in file', 400, { parseErrors });
    }
    if (rows.length === 0) {
      return errorResponse('File appears to be empty', 400);
    }

    // ── Collect all unique raw category/subcategory values from parsed rows ───
    const rawCategoryValues = Array.from(
      new Set(rows.map((r) => r.category).filter((v): v is string => Boolean(v)))
    );
    const rawSubcategoryValues = Array.from(
      new Set(rows.map((r) => r.subcategory).filter((v): v is string => Boolean(v)))
    );

    // ── Build all search variants for each raw value ──────────────────────────
    const categorySearchVariants = rawCategoryValues.flatMap(buildSearchVariants);
    const subcategorySearchVariants = rawSubcategoryValues.flatMap(buildSearchVariants);

    // ── Query DB: match slug OR name (case-insensitive regex) ─────────────────
    const [categories, subcategories] = await Promise.all([
      Category.find({
        $or: [
          { slug: { $in: categorySearchVariants } },
          { name: { $in: categorySearchVariants.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i')) } },
        ],
      }).lean() as unknown as Array<{ _id: { toString(): string }; slug: string; name: string }>,

      Subcategory.find({
        $or: [
          { slug: { $in: subcategorySearchVariants } },
          { name: { $in: subcategorySearchVariants.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i')) } },
        ],
      }).lean() as unknown as Array<{ _id: { toString(): string }; slug: string; name: string }>,
    ]);

    // ── Debug logging (remove in production) ─────────────────────────────────
    console.log('[bulk-upload] rawCategoryValues:', rawCategoryValues);
    console.log('[bulk-upload] categorySearchVariants:', categorySearchVariants);
    console.log('[bulk-upload] categories found in DB:', categories.map((c) => `slug="${c.slug}" name="${c.name}"`));
    console.log('[bulk-upload] rawSubcategoryValues:', rawSubcategoryValues);
    console.log('[bulk-upload] subcategories found in DB:', subcategories.map((s) => `slug="${s.slug}" name="${s.name}"`));

    // ── Build lookup maps ─────────────────────────────────────────────────────
    // We index each DB record by BOTH its slug and its name (lowercased),
    // so any variant of the user's input has a chance to match.
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

    // ── Resolve each row's category/subcategory to ObjectIds ─────────────────
    const resolvedRows: Record<string, unknown>[] = [];
    const resolutionErrors: Array<{ row: number; error: string }> = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2; // row 1 = header, data starts at 2

      // ── Resolve category (required) ───────────────────────────────────────
      const categoryRaw = (row.category as string) ?? '';
      const categoryId = resolveId(categoryRaw, categoryMap);

      if (!categoryId) {
        const tried = buildSearchVariants(categoryRaw).join('", "');
        resolutionErrors.push({
          row: rowNum,
          error: `Category not found: "${categoryRaw}". Tried matching by slug/name: ["${tried}"]. Ensure the category exists in the database.`,
        });
        return;
      }

      const resolvedRow: Record<string, unknown> = { ...row, category: categoryId };

      // ── Resolve subcategory (optional) ────────────────────────────────────
      if (row.subcategory) {
        const subcategoryRaw = row.subcategory as string;
        const subcategoryId = resolveId(subcategoryRaw, subcategoryMap);

        if (!subcategoryId) {
          const tried = buildSearchVariants(subcategoryRaw).join('", "');
          resolutionErrors.push({
            row: rowNum,
            error: `Subcategory not found: "${subcategoryRaw}". Tried matching by slug/name: ["${tried}"]. Ensure the subcategory exists in the database.`,
          });
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
        'No rows could be resolved — all rows had category/subcategory errors',
        400,
        { parseErrors, resolutionErrors },
      );
    }

    // ── Bulk insert ───────────────────────────────────────────────────────────
    const result = await bulkCreateProducts(resolvedRows);

    return successResponse({
      message: `Processed ${rows.length} row${rows.length !== 1 ? 's' : ''}`,
      inserted: result.inserted,
      failed: result.failed + resolutionErrors.length + parseErrors.length,
      errors: [
        ...parseErrors,
        ...resolutionErrors,
        ...result.errors,
      ],
    });
  } catch (err) {
    console.error('[POST /api/admin/bulk-upload]', err);
    return errorResponse(err instanceof Error ? err.message : 'Bulk upload failed', 500);
  }
});

export const GET = withAdmin(async () => {
  const csv = generateCSVTemplate();
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="products-template.csv"',
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Try every variant of `raw` against the map.
 * Returns the first ObjectId string found, or undefined.
 */
function resolveId(raw: string, map: Map<string, string>): string | undefined {
  for (const variant of buildSearchVariants(raw)) {
    const id = map.get(variant) ?? map.get(variant.toLowerCase());
    if (id) return id;
  }
  return undefined;
}

/** Escape special regex characters so we can use user input in a RegExp safely. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}