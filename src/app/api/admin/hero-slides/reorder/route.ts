import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import HeroSlide from '@/models/HeroSlide';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

// POST /api/admin/hero-slides/reorder
// Body: { order: [{ id: string, displayOrder: number }] }
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { order } = await req.json();

    if (!Array.isArray(order)) {
      return errorResponse('order must be an array', 400);
    }

    await Promise.all(
      order.map(({ id, displayOrder }: { id: string; displayOrder: number }) =>
        HeroSlide.findByIdAndUpdate(id, { $set: { displayOrder } })
      )
    );

    return successResponse({ reordered: true });
  } catch (err) {
    console.error('[POST /api/admin/hero-slides/reorder]', err);
    return errorResponse('Failed to reorder slides', 500);
  }
});