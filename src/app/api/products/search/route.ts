import { NextRequest, NextResponse } from "next/server";
// ⚠️ Adjust these two imports to match your actual project paths/names —
// e.g. if your connection helper is `@/lib/mongodb` or `connectDB`, swap it in.
import db from "@/lib/db";
import Product from "@/models/Product";
import {
  extractCarat, extractWeight, escapeRegex,
  CARAT_MATCH_TOLERANCE, weightTolerance,
} from "@/lib/search";

export const dynamic = "force-dynamic";

// Every field a query token is allowed to match against. Add new
// searchable text fields here (and to the `.select()` projection below)
// rather than editing the query logic — this is the single source of
// truth for "what counts as a match."
//
// `legacySku` and `watchModel` are what customers mean by "model number" —
// legacySku is populated straight from the legacy catalogue's `model` /
// `products_model` column for every product kind, not just watches (see
// parseLegacyRow/parseMatchedRow in fileParser.service.ts), so a plain
// substring match on these two already covers model-number search; no
// special parsing needed the way carat/weight need numeric handling below.
// `approxWeight` is free text (e.g. "1/4 to 1/2 ct") that can contain the
// exact phrase a customer types, so it's searched as text too.
const SEARCHABLE_FIELDS = [
  "name",
  "watchBrand",
  "watchModel",
  "gemstoneName",
  "legacySku",
  "description",
  "approxWeight",
] as const;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 50);

  if (!q) return NextResponse.json({ data: [] });

  await db();

  const carat = extractCarat(q);
  const gramWeight = extractWeight(q);

  // Tokenize into words so multi-word queries don't require an exact
  // substring match in one specific order. Previously the whole query
  // was compiled into a single regex, so "diamond round" would NEVER
  // match a product named "Round Diamond, 1.2ct" — the literal
  // substring "diamond round" doesn't appear anywhere in that name.
  // Real-world names/descriptions rarely echo the user's word order
  // back exactly, so this was silently hiding a large chunk of
  // otherwise-matching inventory.
  const tokens = q.split(/\s+/).filter(Boolean);

  // AND across tokens (every word must be found somewhere), OR across
  // fields for each individual token (a word can live in any field).
  const tokenClauses = tokens.map((token) => {
    const rx = new RegExp(escapeRegex(token), "i");
    return { $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: rx })) };
  });

  // Keep a whole-phrase match too. It's redundant with the token-AND
  // clause for most queries, but it's cheap insurance and lets a
  // literal phrase match count even if per-token scoring logic upstream
  // ever changes.
  const wholePhraseRx = new RegExp(escapeRegex(q), "i");
  const wholePhraseClause = {
    $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: wholePhraseRx })),
  };

  const or: Record<string, unknown>[] = [
    { $and: tokenClauses },
    wholePhraseClause,
  ];

  // "0.35 Carat" / "0.35ct" / bare "0.35" — match by carat weight, not by
  // substring, since no text field literally contains the phrase typed.
  //
  // Two different fields can hold carat weight depending on product kind:
  // `size` is only ever populated for productKind "diamond"/"gemstone",
  // but `caratWeight` is populated on the same rows AND on jewelry rows
  // that carry stone weight info too (see parseMatchedRow in
  // fileParser.service.ts) — a jewelry piece with a "1.5 carat diamond"
  // has that 1.5 sitting in `caratWeight` with `size` left undefined.
  // Checking only `size` silently missed every such jewelry item.
  if (carat !== null) {
    const range = { $gte: carat - CARAT_MATCH_TOLERANCE, $lte: carat + CARAT_MATCH_TOLERANCE };
    or.push({ size: range });
    or.push({ caratWeight: range });
  }

  // "5g" / "5 grams" — physical item weight, a different field and a
  // different unit from carat. Only fires on an explicit gram unit so it
  // never collides with a bare-number carat query.
  if (gramWeight !== null) {
    const tol = weightTolerance(gramWeight);
    or.push({ weight: { $gte: gramWeight - tol, $lte: gramWeight + tol } });
  }

  const products = await Product.find({
    isActive: { $ne: false },
    $or: or,
  })
    .select(
      "name price images image category productKind watchBrand watchModel gemstoneName legacySku description size caratWeight weight approxWeight shape color clarity certification"
    )
    // The Product schema has no `slug` field, so it was never actually
    // returned — the client fell back to a fuzzy `/products?search=` link
    // for every result instead of going straight to the product. Populating
    // `category` here (previously left as a bare ObjectId) also fixes the
    // category name shown under each result in the dropdown.
    .populate("category", "name slug")
    .limit(limit)
    .lean();

  return NextResponse.json({ data: products });
}