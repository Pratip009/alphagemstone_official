import { NextRequest, NextResponse } from "next/server";
// ⚠️ Adjust these two imports to match your actual project paths/names —
// e.g. if your connection helper is `@/lib/mongodb` or `connectDB`, swap it in.
import db from "@/lib/db";
import Product from "@/models/Product";
import { extractCarat, escapeRegex, CARAT_MATCH_TOLERANCE } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 50);

  if (!q) return NextResponse.json({ data: [] });

  await db();

  const rx = new RegExp(escapeRegex(q), "i");
  const carat = extractCarat(q);

  const or: Record<string, unknown>[] = [
    { name: rx },
    { watchBrand: rx },
    { watchModel: rx },
    { gemstoneName: rx },
    { legacySku: rx },
  ];

  // "0.35 Carat" / "0.35ct" / bare "0.35" — match by weight, not by substring,
  // since no text field literally contains the phrase the user typed.
  if (carat !== null) {
    or.push({ size: { $gte: carat - CARAT_MATCH_TOLERANCE, $lte: carat + CARAT_MATCH_TOLERANCE } });
  }

  const products = await Product.find({ isActive: { $ne: false }, $or: or })
    .select(
      "name slug price images image category productKind watchBrand watchModel gemstoneName legacySku size shape color clarity certification"
    )
    .limit(limit)
    .lean();

  return NextResponse.json({ data: products });
}