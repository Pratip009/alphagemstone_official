import { connectDB } from '@/lib/db';
import { getOrderById, updateOrderStatus } from '@/services/order.service';
import { withCartAuth, withAdmin, CartAuthenticatedRequest, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET works for a logged-in user (their own orders), a guest (their own
// order, matched via guest_id cookie — this is how the post-checkout
// confirmation page re-fetches the order it just created), or an admin
// (any order).
export const GET = withCartAuth(async (req: CartAuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const identity = req.user?.role === 'admin' ? undefined : req.identity;
    const order = await getOrderById(id, identity);
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
