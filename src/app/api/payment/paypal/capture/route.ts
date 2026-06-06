import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { capturePayment } from '@/services/order.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/payment/paypal/capture
 * Body: { paypalOrderId: string }
 * → Captures payment, updates order status, decrements stock
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { paypalOrderId } = await req.json();
    if (!paypalOrderId) return errorResponse('paypalOrderId is required', 400);

    const order = await capturePayment(paypalOrderId);
    return successResponse({ order, message: 'Payment captured successfully' });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Payment capture failed', 500);
  }
});
