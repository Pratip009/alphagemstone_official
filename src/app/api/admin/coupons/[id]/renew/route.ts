import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { renewCoupon } from '@/services/coupon.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

// POST /api/admin/coupons/[id]/renew
// Resets a used/expired coupon back to usable with a fresh expiry.
export const POST = withAdmin(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    await connectDB();
    const coupon = await renewCoupon(id);
    return successResponse({ message: 'Coupon renewed.', coupon });
  } catch (err) {
    console.error('[admin/coupons/renew]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to renew coupon', 400);
  }
});