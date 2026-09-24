import { NextRequest, NextResponse } from "next/server";
import { parseFinderParams, runFinder } from "@/lib/finder";

// Registers the Category schema (used for category facet names).
import "@/models/Category";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/finder — powers the homepage product finder.
 * Query params: q, category, lots=1, gems, shapes, colors, grades (comma
 * lists), mmMin/mmMax, ctMin/ctMax, priceMin/priceMax, sort, page, limit.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await runFinder(parseFinderParams(req.nextUrl.searchParams));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[finder]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}