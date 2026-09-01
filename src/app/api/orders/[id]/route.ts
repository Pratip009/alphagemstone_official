import { connectDB } from '@/lib/db';
import { getOrderById, updateOrderStatus, cancelOwnPendingOrder } from '@/services/order.service';
import { withAuth, withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const userId = req.user.role === 'admin' ? undefined : req.user.userId;
    const order = await getOrderById(id, userId);
    if (!order) return errorResponse('Order not found', 404);
    return successResponse(order);
  } catch {
    return errorResponse('Failed to fetch order', 500);
  }
});

export const PUT = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const { status } = await req.json();
    if (!status) return errorResponse('Status is required', 400);
    const order = await updateOrderStatus(id, status);
    if (!order) return errorResponse('Order not found', 404);
    return successResponse(order);
  } catch (err: any) {
    return errorResponse(err.message ?? 'Failed to update order', 500);
  }
});

// DELETE /api/orders/[id] — customer cancels their OWN order, only while it's
// still pending and unpaid. Used by checkout: if the customer goes back and
// re-confirms a different shipping rate, the old pending order (and the
// stock it reserved) is released instead of being left orphaned.
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const order = await cancelOwnPendingOrder(id, req.user.userId);
    return successResponse(order);
  } catch (err: any) {
    return errorResponse(err.message ?? 'Failed to cancel order', 400);
  }
});