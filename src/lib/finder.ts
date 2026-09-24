/**
 * finder.ts — the engine behind the homepage "Complete gemstone source"
 * finder (and /api/products/finder).
 *
 * One call returns: a page of matching products, the total match count,
 * and live counts for every filter option ("facets"), each computed with
 * that filter's own selection removed — so choosing "Oval" still shows how
 * many Round / Pear / … stones match everything else.
 *
 * Built on aggregate() rather than find() on purpose: aggregation stages
 * are not cast against the Mongoose schema, so fields the importer wrote
 * that aren't declared on the schema (e.g. legacy `sizeMm`) still work,
 * and the mm size can fall back to parsing "8x6 mm" out of the product
 * name/dimensions when `sizeMm` is missing.
 */
import mongoose, { type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import Category from "@/models/Category";
import { SHAPES } from "@/lib/productAttributes";
import { escapeRegex } from "@/lib/search";

// ─── Public types ────────────────────────────────────────────────────────────
export type FinderSort = "relevance" | "newest" | "price_asc" | "price_desc" | "size_desc" | "size_asc";

export interface FinderParams {
  q?: string;
  categories?: string[];  // Category ObjectIds (several when names repeat)
  lots?: boolean;         // wholesale lots / parcels only
  gems?: string[];        // exact gemstoneName values
  shapes?: string[];      // SHAPES values
  colors?: string[];      // COLOR_FAMILIES keys
  grades?: string[];      // exact gradeRaw values
  mmMin?: number;
  mmMax?: number;
  ctMin?: number;
  ctMax?: number;
  priceMin?: number;
  priceMax?: number;
  sort?: FinderSort;
  page?: number;
  limit?: number;
}

export interface FinderProduct {
  _id: string;
  name: string;
  slug?: string;
  price?: number;
  image?: string;
  productKind?: string;
  gemstoneName?: string;
  shape?: string[];
  mm?: number | null;
  carat?: number;
  color?: string;
  grade?: string;
}

export interface FacetValue { value: string; label: string; count: number }

export interface FinderResult {
  products: FinderProduct[];
  total: number;
  page: number;
  pages: number;
  facets: {
    categories: FacetValue[];
    lots: number;
    gems: FacetValue[];
    shapes: FacetValue[];
    colors: FacetValue[];
    grades: FacetValue[];
  };
}

// ─── Vocabularies ────────────────────────────────────────────────────────────
/** Color families → case-insensitive pattern matched against `colorRaw`. */
export const COLOR_FAMILIES: Record<string, { label: string; pattern: string }> = {
  red:    { label: "Red",           pattern: "red|crimson|raspberry|ruby|scarlet|cherry|wine" },
  pink:   { label: "Pink",          pattern: "pink|rose|magenta|fuchsia|blush" },
  orange: { label: "Orange",        pattern: "orange|padparadscha|peach|mandarin|tangerine|copper|madeira" },
  yellow: { label: "Yellow & gold", pattern: "yellow|golden|gold|canary|lemon|champagne|honey" },
  green:  { label: "Green",         pattern: "green|mint|olive|lime|forest|emerald" },
  blue:   { label: "Blue",          pattern: "blue|sky|navy|aqua|teal|cornflower|sapphire|paraiba" },
  purple: { label: "Purple",        pattern: "purple|violet|lavender|plum|lilac|grape|amethyst" },
  white:  { label: "White & clear", pattern: "white|colorless|colourless|clear|silver|icy|milky|^\\s*[d-k](\\s*[-/]?\\s*[d-k])?\\s*$" },
  black:  { label: "Black & gray",  pattern: "black|gr[ae]y|smoky|smoke|charcoal" },
  brown:  { label: "Brown",         pattern: "brown|chocolate|cognac|coffee|bronze|cinnamon|tan\\b|^\\s*c\\d" },
  multi:  { label: "Multicolor",    pattern: "multi|bi-?colou?r|tri-?colou?r|rainbow|mixed|assorted|party|mystic|azotic|mercury mist|twilight" },
};

/** Names that mark a wholesale lot / parcel. */
const LOT_PATTERN = "\\blots?\\b|\\bparcels?\\b|\\btwt\\b|\\bassorted\\b";

const SORTS: FinderSort[] = ["relevance", "newest", "price_asc", "price_desc", "size_desc", "size_asc"];
const STOP_WORDS = new Set(["mm", "ct", "cts", "carat", "carats", "the", "and", "of", "in", "a", "with"]);
const SHAPE_SET = new Set<string>(SHAPES as readonly string[]);

// ─── Param parsing (safe for untrusted query strings) ────────────────────────
function num(v: string | null, min = 0, max = 1e7): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}
function list(v: string | null, maxItems = 30, maxLen = 100): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
}

export function parseFinderParams(sp: URLSearchParams): FinderParams {
  const sort = sp.get("sort") as FinderSort | null;
  return {
    q: (sp.get("q") ?? "").trim().slice(0, 120) || undefined,
    categories: list(sp.get("category"), 10, 24).filter((c) => /^[a-f\d]{24}$/i.test(c)),
    lots: sp.get("lots") === "1",
    gems: list(sp.get("gems")),
    shapes: list(sp.get("shapes")).filter((s) => SHAPE_SET.has(s)),
    colors: list(sp.get("colors")).filter((c) => c in COLOR_FAMILIES),
    grades: list(sp.get("grades")),
    mmMin: num(sp.get("mmMin"), 0, 500),
    mmMax: num(sp.get("mmMax"), 0, 500),
    ctMin: num(sp.get("ctMin"), 0, 1e6),
    ctMax: num(sp.get("ctMax"), 0, 1e6),
    priceMin: num(sp.get("priceMin")),
    priceMax: num(sp.get("priceMax")),
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: num(sp.get("page"), 1, 2000),
    limit: num(sp.get("limit"), 1, 48),
  };
}

// ─── Match building ──────────────────────────────────────────────────────────
type Dim = "category" | "lots" | "gems" | "shapes" | "colors" | "grades";
type Match = Record<string, unknown>;

/** Text search: every meaningful word must appear in at least one field. */
function textConditions(q: string): Match[] {
  const normalized = q.toLowerCase().replace(/(\d)\s*(mm|ct|cts|carats?)\b/g, "$1");
  const tokens = normalized
    .split(/[\s,]+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .slice(0, 8);
  return tokens.map((t) => {
    const rx = { $regex: escapeRegex(t), $options: "i" };
    return {
      $or: [
        { name: rx }, { gemstoneName: rx }, { legacySku: rx }, { colorRaw: rx },
        { gradeRaw: rx }, { watchBrand: rx }, { watchModel: rx }, { approxWeight: rx },
        { dimensions: rx },
      ],
    };
  });
}

/** Everything except the mm range (which needs a computed field). */
function buildMatch(p: FinderParams, skip?: Dim): Match {
  const and: Match[] = [{ isActive: { $ne: false } }];

  if (p.q) and.push(...textConditions(p.q));
  if (skip !== "category" && p.categories?.length) {
    and.push({ category: { $in: p.categories.map((c) => new mongoose.Types.ObjectId(c)) } });
  }
  if (skip !== "lots" && p.lots) and.push({ name: { $regex: LOT_PATTERN, $options: "i" } });
  if (skip !== "gems" && p.gems?.length) and.push({ gemstoneName: { $in: p.gems } });
  if (skip !== "shapes" && p.shapes?.length) and.push({ shape: { $in: p.shapes } });
  if (skip !== "grades" && p.grades?.length) and.push({ gradeRaw: { $in: p.grades } });
  if (skip !== "colors" && p.colors?.length) {
    const pattern = p.colors.map((c) => COLOR_FAMILIES[c].pattern).join("|");
    and.push({ colorRaw: { $regex: pattern, $options: "i" } });
  }
  if (p.ctMin != null || p.ctMax != null) {
    and.push({ size: { ...(p.ctMin != null && { $gte: p.ctMin }), ...(p.ctMax != null && { $lte: p.ctMax }) } });
  }
  if (p.priceMin != null || p.priceMax != null) {
    and.push({ price: { ...(p.priceMin != null && { $gte: p.priceMin }), ...(p.priceMax != null && { $lte: p.priceMax }) } });
  }
  return { $and: and };
}

const MM_FROM_TEXT = "(\\d+(?:\\.\\d+)?)\\s*(?:[x×]\\s*\\d+(?:\\.\\d+)?\\s*)?mm";

/** Adds `_mm`: sizeMm if present, else the first "N mm" / "NxM mm" in dimensions or name. */
const MM_STAGE: PipelineStage = {
  $addFields: {
    _mm: {
      $let: {
        vars: {
          fromText: {
            $regexFind: {
              input: { $concat: [{ $ifNull: ["$dimensions", ""] }, " ", { $ifNull: ["$name", ""] }] },
              regex: MM_FROM_TEXT,
              options: "i",
            },
          },
        },
        in: {
          $ifNull: [
            { $convert: { input: "$sizeMm", to: "double", onError: null, onNull: null } },
            {
              $convert: {
                input: { $arrayElemAt: [{ $ifNull: ["$$fromText.captures", []] }, 0] },
                to: "double", onError: null, onNull: null,
              },
            },
          ],
        },
      },
    },
  },
};

function mmStages(p: FinderParams): PipelineStage[] {
  if (p.mmMin == null && p.mmMax == null) return [];
  return [
    MM_STAGE,
    { $match: { _mm: { ...(p.mmMin != null && { $gte: p.mmMin }), ...(p.mmMax != null && { $lte: p.mmMax }) } } },
  ];
}

/** $match plus the optional mm filter — the base of every pipeline. */
function base(p: FinderParams, skip?: Dim): PipelineStage[] {
  return [{ $match: buildMatch(p, skip) }, ...mmStages(p)];
}

// ─── Facet pipelines ─────────────────────────────────────────────────────────
async function countBy(p: FinderParams, dim: Dim, field: string, limit: number, unwind = false) {
  const stages: PipelineStage[] = [...base(p, dim)];
  if (unwind) stages.push({ $unwind: `$${field}` });
  stages.push(
    { $match: { [field]: { $nin: [null, ""] } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: limit },
  );
  return Product.aggregate<{ _id: unknown; n: number }>(stages);
}

async function colorAndLotCounts(p: FinderParams) {
  const colorGroup: Record<string, unknown> = { _id: null };
  for (const [key, fam] of Object.entries(COLOR_FAMILIES)) {
    colorGroup[key] = {
      $sum: {
        $cond: [
          { $regexMatch: { input: { $ifNull: ["$colorRaw", ""] }, regex: fam.pattern, options: "i" } },
          1, 0,
        ],
      },
    };
  }
  const [colors, lots] = await Promise.all([
    Product.aggregate<Record<string, number>>([...base(p, "colors"), { $group: colorGroup } as PipelineStage]),
    Product.aggregate<{ n: number }>([
      ...base(p, "lots"),
      { $match: { name: { $regex: LOT_PATTERN, $options: "i" } } },
      { $count: "n" },
    ]),
  ]);
  return { colors: colors[0] ?? {}, lots: lots[0]?.n ?? 0 };
}

// ─── Main entry ──────────────────────────────────────────────────────────────
// Every sort ends with _id: bulk-imported products share createdAt (and
// many share a price), and without a unique tie-breaker MongoDB may order
// ties differently on each query — so "Show more" pages could overlap.
const SORT_STAGE: Record<FinderSort, Record<string, 1 | -1>> = {
  relevance:  { _score: -1, createdAt: -1, _id: -1 },
  newest:     { createdAt: -1, _id: -1 },
  price_asc:  { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  size_desc:  { size: -1, _id: -1 },
  size_asc:   { size: 1, _id: 1 },
};

export async function runFinder(p: FinderParams): Promise<FinderResult> {
  await connectDB();

  const limit = p.limit ?? 12;
  const page = p.page ?? 1;
  const sort: FinderSort = p.sort ?? (p.q ? "relevance" : "newest");

  const scoreStage: PipelineStage[] =
    sort === "relevance" && p.q
      ? [{
          $addFields: {
            _score: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ["$name", ""] }, regex: escapeRegex(p.q), options: "i" } },
                1, 0,
              ],
            },
          },
        }]
      : [];

  const resultsPipeline: PipelineStage[] = [
    ...base(p),
    {
      $facet: {
        total: [{ $count: "n" }],
        items: [
          ...(scoreStage as PipelineStage.FacetPipelineStage[]),
          { $sort: SORT_STAGE[sort === "relevance" && !p.q ? "newest" : sort] },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...((p.mmMin == null && p.mmMax == null ? [MM_STAGE] : []) as PipelineStage.FacetPipelineStage[]),
          {
            $project: {
              name: 1, slug: 1, price: 1, productKind: 1, gemstoneName: 1, shape: 1,
              size: 1, colorRaw: 1, gradeRaw: 1, _mm: 1,
              image: { $arrayElemAt: [{ $ifNull: ["$images", []] }, 0] },
            },
          },
        ],
      },
    },
  ];

  const [results, cats, gems, shapes, grades, colorLots] = await Promise.all([
    Product.aggregate<{ total: { n: number }[]; items: Record<string, unknown>[] }>(resultsPipeline),
    countBy(p, "category", "category", 20),
    countBy(p, "gems", "gemstoneName", 60),
    countBy(p, "shapes", "shape", 30, true),
    countBy(p, "grades", "gradeRaw", 16),
    colorAndLotCounts(p),
  ]);

  const catDocs = cats.length
    ? await Category.find({ _id: { $in: cats.map((c) => c._id) } }).select("name").lean<{ _id: unknown; name: string }[]>()
    : [];
  const catName = new Map(catDocs.map((c) => [String(c._id), c.name]));

  const total = results[0]?.total[0]?.n ?? 0;
  const products: FinderProduct[] = (results[0]?.items ?? []).map((d) => ({
    _id: String(d._id),
    name: String(d.name ?? ""),
    slug: (d.slug as string) || undefined,
    price: typeof d.price === "number" ? d.price : undefined,
    image: typeof d.image === "string" ? d.image : undefined,
    productKind: d.productKind as string | undefined,
    gemstoneName: d.gemstoneName as string | undefined,
    shape: Array.isArray(d.shape) ? (d.shape as string[]) : undefined,
    mm: typeof d._mm === "number" ? d._mm : null,
    carat: typeof d.size === "number" ? d.size : undefined,
    color: d.colorRaw as string | undefined,
    grade: d.gradeRaw as string | undefined,
  }));

  return {
    products,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    facets: {
      // Categories sharing a name (e.g. two "Diamonds" records) merge into
      // one entry whose value is a comma list of their ids.
      categories: Array.from(
        cats
          .filter((c) => catName.has(String(c._id)))
          .reduce((acc, c) => {
            const label = catName.get(String(c._id))!.trim();
            const key = label.toLowerCase();
            const cur = acc.get(key);
            if (cur) { cur.value += `,${String(c._id)}`; cur.count += c.n; }
            else acc.set(key, { value: String(c._id), label, count: c.n });
            return acc;
          }, new Map<string, FacetValue>())
          .values(),
      ),
      lots: colorLots.lots,
      gems: gems.map((g) => ({ value: String(g._id), label: String(g._id), count: g.n })),
      shapes: shapes
        .filter((s) => s._id !== "other")
        .map((s) => ({ value: String(s._id), label: String(s._id), count: s.n })),
      colors: Object.entries(COLOR_FAMILIES).map(([key, fam]) => ({
        value: key, label: fam.label, count: Number(colorLots.colors[key] ?? 0),
      })),
      grades: grades.map((g) => ({ value: String(g._id), label: String(g._id), count: g.n })),
    },
  };
}