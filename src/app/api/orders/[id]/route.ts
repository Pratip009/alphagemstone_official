import { connectDB } from '@/lib/db';
import { getOrderById, updateOrderStatus } from '@/services/order.service'; // ← add updateOrderStatus here
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