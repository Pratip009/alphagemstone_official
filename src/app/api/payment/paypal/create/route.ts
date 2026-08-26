import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { initiatePayPalPayment } from '@/services/order.service';
import { withCartAuth, CartAuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/payment/paypal/create
 * Body: { orderId: string }
 * → Creates PayPal order, returns approvalUrl
 * Works for a logged-in user or a guest (identity resolved via auth/guest
 * cookie) — the ownership check happens in initiatePayPalPayment.
 */
export const POST = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const { orderId } = await req.json();
    if (!orderId) return errorResponse('orderId is required', 400);

    const result = await initiatePayPalPayment(orderId, req.identity);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'PayPal init failed', 500);
  }
});
