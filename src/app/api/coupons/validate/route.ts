import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateCoupon } from '@/services/coupon.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// POST /api/coupons/validate
export async function POST(req: NextRequest) {
  try {
    // Prevent coupon-code brute forcing / discovery scripts.
    const limit = await rateLimit(req, { id: 'coupon-validate', limit: 20, windowSec: 60 });
    if (!limit.success) return rateLimitResponse(limit);

    await connectDB();
    const body = await req.json();
    const code     = body?.code?.toString().trim();
    const subtotal = Number(body?.subtotal);

    if (!code)                return errorResponse('Coupon code is required.', 400);
    if (isNaN(subtotal) || subtotal < 0) return errorResponse('Invalid subtotal.', 400);

    const result = await validateCoupon(code, subtotal);
    return successResponse(result);
  } catch (err) {
    console.error('[coupon/validate]', err);
    return errorResponse('Failed to validate coupon', 500);
  }
}