import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { initiatePayPalPayment, capturePayment } from '@/services/order.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/payment/paypal/create
 * Body: { orderId: string }
 * → Creates PayPal order, returns approvalUrl
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { orderId } = await req.json();
    if (!orderId) return errorResponse('orderId is required', 400);

    const result = await initiatePayPalPayment(orderId);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'PayPal init failed', 500);
  }
});
