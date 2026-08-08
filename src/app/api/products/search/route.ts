import { NextRequest, NextResponse } from "next/server";
// ⚠️ Adjust these two imports to match your actual project paths/names —
// e.g. if your connection helper is `@/lib/mongodb` or `connectDB`, swap it in.
import db from "@/lib/db";
import Product from "@/models/Product";
import { extractCarat, escapeRegex, CARAT_MATCH_TOLERANCE } from "@/lib/search";

export const dynamic = "force-dynamic";

// Every field a query token is allowed to match against. Add new
// searchable text fields here (and to the `.select()` projection below)
// rather than editing the query logic — this is the single source of
// truth for "what counts as a match."
const SEARCHABLE_FIELDS = [
  "name",
  "watchBrand",
  "watchModel",
  "gemstoneName",
  "legacySku",
  "description",
] as const;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 50);

  if (!q) return NextResponse.json({ data: [] });

  await db();

  const carat = extractCarat(q);

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

  // "0.35 Carat" / "0.35ct" / bare "0.35" — match by weight, not by
  // substring, since no text field literally contains the phrase typed.
  if (carat !== null) {
    or.push({
      size: { $gte: carat - CARAT_MATCH_TOLERANCE, $lte: carat + CARAT_MATCH_TOLERANCE },
    });
  }

  const products = await Product.find({
    isActive: { $ne: false },
    $or: or,
  })
    .select(
      "name slug price images image category productKind watchBrand watchModel gemstoneName legacySku description size shape color clarity certification"
    )
    .limit(limit)
    .lean();

  return NextResponse.json({ data: products });
}