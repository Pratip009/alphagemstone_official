import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Category from "@/models/Category";
import Subcategory from "@/models/Subcategory";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
export interface ProductCard {
  _id: string;
  name: string;
  category: string;
  shape: string;
  size: number;
  color: string;
  clarity: string;
  certification: string;
  price: number;
  images: string[];
  stock: number;
  description: string;
  score?: number;
}

export interface CategoryCard {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  productCount?: number;
  parentId?: string;
  parentName?: string;
}

interface SearchArgs {
  shape?: string;
  color?: string;
  clarity?: string;
  certification?: string;
  priceMin?: number;
  priceMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  categoryName?: string;
  subcategoryId?: string;
  limit?: number;
}

interface RecommendArgs {
  maxPrice?: number;
  minPrice?: number;
  categoryName?: string;
  subcategoryId?: string;
  shape?: string;
  minSize?: number;
  certification?: string;
  purpose?: string;
}

/* ─────────────────────────────────────────────
   Clarity rank helper (FL best → SI2 worst)
───────────────────────────────────────────── */
const CLARITY_RANK: Record<string, number> = {
  FL: 8, IF: 7, VVS1: 6, VVS2: 5, VS1: 4, VS2: 3, SI1: 2, SI2: 1,
};

/* ─────────────────────────────────────────────
   Score helper (0-100)
───────────────────────────────────────────── */
export function computeScore(
  product: { price: number; clarity: string; stock: number },
  opts: { budgetMax?: number } = {}
): number {
  let score = 50;
  const clarityScore = (CLARITY_RANK[product.clarity] ?? 0) * (30 / 8);
  score += clarityScore;
  if (opts.budgetMax && opts.budgetMax > 0) {
    const ratio = product.price / opts.budgetMax;
    if (ratio <= 1) score += Math.round(20 * ratio);
  }
  score += Math.min(product.stock, 10);
  return Math.min(Math.round(score), 100);
}

/* ─────────────────────────────────────────────
   lean helper – serialises ObjectId / Date
───────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialise(doc: any): any {
  if (!doc) return null;
  return JSON.parse(JSON.stringify(doc));
}

/* ─────────────────────────────────────────────
   1. searchProducts
───────────────────────────────────────────── */
export async function searchProducts(args: SearchArgs): Promise<ProductCard[]> {
  await dbConnect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { isActive: true };

  if (args.shape)         filter.shape         = args.shape;
  if (args.color)         filter.color         = args.color;
  if (args.clarity)       filter.clarity       = args.clarity;
  if (args.certification) filter.certification = args.certification;

  // Prefer subcategoryId over categoryName for precision
  if (args.subcategoryId) {
    filter.category = args.subcategoryId;
  }

  if (args.priceMin !== undefined || args.priceMax !== undefined) {
    filter.price = {};
    if (args.priceMin !== undefined) filter.price.$gte = args.priceMin;
    if (args.priceMax !== undefined) filter.price.$lte = args.priceMax;
  }

  if (args.sizeMin !== undefined || args.sizeMax !== undefined) {
    filter.size = {};
    if (args.sizeMin !== undefined) filter.size.$gte = args.sizeMin;
    if (args.sizeMax !== undefined) filter.size.$lte = args.sizeMax;
  }

  const limit = args.limit ?? 6;

  const results = await Product.find(filter)
    .populate("category", "name slug")
    .limit(args.categoryName && !args.subcategoryId ? limit * 3 : limit) // fetch more for in-memory category filter
    .lean();

  // In-memory category name filter (only when no subcategoryId)
  const filtered =
    args.categoryName && !args.subcategoryId
      ? results.filter((p) => {
          const cat = p.category as { name?: string } | null;
          return cat?.name?.match(new RegExp(args.categoryName!, "i"));
        })
      : results;

  return filtered.slice(0, limit).map((p) => {
    const s = serialise(p);
    return {
      ...s,
      category: (s.category as { name?: string })?.name ?? "",
      score: computeScore(s),
    };
  });
}

/* ─────────────────────────────────────────────
   2. getProduct
───────────────────────────────────────────── */
export async function getProduct(id: string): Promise<ProductCard | null> {
  await dbConnect();
  const p = await Product.findById(id)
    .populate("category", "name slug")
    .lean();
  if (!p) return null;
  const s = serialise(p);
  return {
    ...s,
    category: (s.category as { name?: string })?.name ?? "",
    score: computeScore(s),
  };
}

/* ─────────────────────────────────────────────
   3. compareProducts
───────────────────────────────────────────── */
export interface ComparisonResult {
  productA: ProductCard;
  productB: ProductCard;
  winner: "A" | "B" | "tie";
  reasoning: string;
  table: Array<{
    attribute: string;
    valueA: string | number;
    valueB: string | number;
    winner: "A" | "B" | "tie";
  }>;
}

export async function compareProducts(
  idA: string,
  idB: string
): Promise<ComparisonResult | null> {
  await dbConnect();
  const [pA, pB] = await Promise.all([getProduct(idA), getProduct(idB)]);
  if (!pA || !pB) return null;

  const scoreA = computeScore(pA);
  const scoreB = computeScore(pB);
  const winner: "A" | "B" | "tie" =
    scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "tie";

  const table = [
    { attribute: "Price (USD)", valueA: pA.price, valueB: pB.price, winner: (pA.price <= pB.price ? "A" : "B") as "A" | "B" | "tie" },
    { attribute: "Carat",       valueA: pA.size,  valueB: pB.size,  winner: (pA.size >= pB.size ? "A" : "B") as "A" | "B" | "tie" },
    { attribute: "Clarity",     valueA: pA.clarity, valueB: pB.clarity, winner: ((CLARITY_RANK[pA.clarity] ?? 0) >= (CLARITY_RANK[pB.clarity] ?? 0) ? "A" : "B") as "A" | "B" | "tie" },
    { attribute: "Color",       valueA: pA.color, valueB: pB.color, winner: (pA.color <= pB.color ? "A" : "B") as "A" | "B" | "tie" },
    { attribute: "Shape",       valueA: pA.shape, valueB: pB.shape, winner: "tie" as "A" | "B" | "tie" },
    { attribute: "Certification", valueA: pA.certification, valueB: pB.certification, winner: "tie" as "A" | "B" | "tie" },
    { attribute: "Match Score", valueA: scoreA, valueB: scoreB, winner },
  ];

  const reasoning =
    winner === "tie"
      ? `Both stones are exceptionally matched with a score of ${scoreA}/100. Your choice may come down to personal preference.`
      : winner === "A"
      ? `${pA.name} scores higher (${scoreA} vs ${scoreB}) — offering superior clarity and value.`
      : `${pB.name} scores higher (${scoreB} vs ${scoreA}) — offering superior clarity and value.`;

  return { productA: pA, productB: pB, winner, reasoning, table };
}

/* ─────────────────────────────────────────────
   4. findSimilar
───────────────────────────────────────────── */
export async function findSimilar(
  id: string,
  budgetVariance = 0.2
): Promise<ProductCard[]> {
  await dbConnect();
  const ref = await getProduct(id);
  if (!ref) return [];

  const results = await searchProducts({
    shape: ref.shape,
    priceMin: ref.price * (1 - budgetVariance),
    priceMax: ref.price * (1 + budgetVariance),
    limit: 7,
  });

  return results.filter((p) => p._id.toString() !== id.toString()).slice(0, 6);
}

/* ─────────────────────────────────────────────
   5. recommendProducts
───────────────────────────────────────────── */
export async function recommendProducts(args: RecommendArgs): Promise<ProductCard[]> {
  await dbConnect();

  const products = await searchProducts({
    priceMin: args.minPrice,
    priceMax: args.maxPrice,
    shape: args.shape,
    sizeMin: args.minSize,
    certification: args.certification,
    categoryName: args.categoryName,
    subcategoryId: args.subcategoryId,
    limit: 20,
  });

  const scored = products.map((p) => ({
    ...p,
    score: computeScore(p, { budgetMax: args.maxPrice }),
  }));

  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored.slice(0, 6);
}

/* ─────────────────────────────────────────────
   6. getInventorySummary
───────────────────────────────────────────── */
export interface InventorySummary {
  category: string;
  count: number;
  minPrice: number;
  maxPrice: number;
}

export async function getInventorySummary(): Promise<InventorySummary[]> {
  await dbConnect();

  const results = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryData",
      },
    },
    { $unwind: { path: "$categoryData", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$categoryData.name",
        count: { $sum: 1 },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return results.map((r) => ({
    category: r._id ?? "Uncategorised",
    count: r.count,
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
  }));
}

/* ─────────────────────────────────────────────
   7. getCategories  ← NEW
   Returns all top-level categories (no parent).
───────────────────────────────────────────── */
export async function getCategories(): Promise<CategoryCard[]> {
  await dbConnect();

  // Top-level categories have no `category` field (subcategories have category: parentId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    $or: [{ category: null }, { category: { $exists: false } }],
  };

  const cats = await Category.find(filter).lean();
  console.log(`[getCategories] raw DB result count: ${cats.length}`);
  if (cats.length > 0) {
    console.log(`[getCategories] sample:`, JSON.stringify(cats[0]));
  }

  // Count products per category
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return cats.map((c) => {
    const s = serialise(c);
    return {
      _id: s._id,
      name: s.name,
      slug: s.slug ?? s.name?.toLowerCase().replace(/\s+/g, "-"),
      image: s.imageUrl ?? s.image ?? s.images?.[0] ?? undefined,
      description: s.description ?? undefined,
      productCount: countMap.get(s._id) ?? 0,
    } as CategoryCard;
  });
}

/* ─────────────────────────────────────────────
   8. getSubcategories  ← NEW
   Returns children of a given parent category.
───────────────────────────────────────────── */
export async function getSubcategories(parentId: string): Promise<CategoryCard[]> {
  await dbConnect();

  console.log(`[getSubcategories] looking for children of parentId: ${parentId}`);

  // Cast string to ObjectId — Mongoose won't auto-coerce for ObjectId fields
  const mongoose = await import("mongoose");
  const parentObjectId = new mongoose.Types.ObjectId(parentId);

  // Subcategories store their parent's _id in the `category` field
  const cats = await Subcategory.find({ category: parentObjectId }).lean();
  console.log(`[getSubcategories] raw DB result count: ${cats.length}`);
  if (cats.length > 0) {
    console.log(`[getSubcategories] sample:`, JSON.stringify(cats[0]));
  }

  // Get parent name for breadcrumb display
  const parentDoc = await Category.findById(parentId).lean();
  const parentName = (parentDoc as { name?: string } | null)?.name ?? undefined;

  // Count products per subcategory
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return cats.map((c) => {
    const s = serialise(c);
    return {
      _id: s._id,
      name: s.name,
      slug: s.slug ?? s.name?.toLowerCase().replace(/\s+/g, "-"),
      image: s.imageUrl ?? s.image ?? s.images?.[0] ?? undefined,
      description: s.description ?? undefined,
      productCount: countMap.get(s._id) ?? 0,
      parentId,
      parentName,
    } as CategoryCard;
  });
}

/* ─────────────────────────────────────────────
   Tool dispatcher
───────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchTool(name: string, args: any): Promise<unknown> {
  console.log(`[dispatchTool] "${name}"`, args);
  switch (name) {
    case "search_products":
      return await searchProducts(args as SearchArgs);
    case "get_product":
      return await getProduct(args.id as string);
    case "compare_products":
      return await compareProducts(args.idA as string, args.idB as string);
    case "find_similar":
      return await findSimilar(args.id as string, args.budgetVariance as number | undefined);
    case "recommend_products":
      return await recommendProducts(args as RecommendArgs);
    case "get_inventory_summary":
      return await getInventorySummary();
    case "get_categories":                            // ← NEW
      return await getCategories();
    case "get_subcategories":                         // ← NEW
      return await getSubcategories(args.parentId as string);
    default:
      console.error(`[dispatchTool] Unknown tool: "${name}"`);
      return { error: `Unknown tool: ${name}` };
  }
}