import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { listSubSubcategories } from '@/services/category.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import Subcategory from '@/models/Subcategory';

// ── GET /api/subsubcategories?subcategory=<slug|id> ─────────────────────────
// Public, read-only. Returns the active sub-subcategories nested under a
// subcategory — e.g. ?subcategory=tanzanite → Oval Tanzanite, Trillion
// Tanzanite, Calibrated Tanzanite, …
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const raw = req.nextUrl.searchParams.get('subcategory');
    if (!raw) return errorResponse('subcategory query param is required', 400);

    const isObjectId = /^[a-f\d]{24}$/i.test(raw);
    let subcategoryId = raw;
    if (!isObjectId) {
      const sub = await Subcategory.findOne({ slug: raw, isActive: true })
        .select('_id')
        .lean();
      if (!sub) return successResponse([]);
      subcategoryId = String((sub as any)._id);
    }

    const items = await listSubSubcategories(subcategoryId);
    return successResponse(items);
  } catch {
    return errorResponse('Failed to fetch sub-subcategories', 500);
  }
}
