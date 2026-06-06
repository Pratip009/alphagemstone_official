import { connectDB } from "@/lib/db";
import { listProducts } from "@/services/product.service";
import { errorResponse } from "@/lib/api-response";

const CATEGORY_SLUG_REGEX = /^[a-z0-9-]+$/;

export const GET = async (req: Request) => {
  try {
    await connectDB();
    const sp = new URL(req.url).searchParams;

    // ✅ fixed: validated and clamped pagination params
    const page  = Math.max(1, Number(sp.get("page")  || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit") || 60)));

    // ✅ fixed: validated category slug format
    const rawCategory = sp.get("category");
    const category = rawCategory && CATEGORY_SLUG_REGEX.test(rawCategory)
      ? rawCategory
      : undefined;

    const { products, total } = await listProducts({ page, limit, category });

    // ✅ fixed: use total from DB, not filtered array length
    const active = (products as Array<{ isActive: boolean }>).filter((p) => p.isActive);

    return Response.json({ success: true, data: active, total, page, limit });
  } catch (err) {
    console.error('[listProducts]', err);
    return errorResponse("Failed to fetch products", 500);
  }
};