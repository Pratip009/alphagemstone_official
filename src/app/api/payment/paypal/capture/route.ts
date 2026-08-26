import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { capturePayment } from '@/services/order.service';
import { withCartAuth, CartAuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/payment/paypal/capture
 * Body: { paypalOrderId: string }
 * → Captures payment, updates order status, decrements stock
 * Works for a logged-in user or a guest — the ownership check happens in
 * capturePayment.
 */
export const POST = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const { paypalOrderId } = await req.json();
    if (!paypalOrderId) return errorResponse('paypalOrderId is required', 400);

    const order = await capturePayment(paypalOrderId, req.identity);
    return successResponse({ order, message: 'Payment captured successfully' });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Payment capture failed', 500);
  }
});
