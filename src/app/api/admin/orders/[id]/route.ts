import { connectDB } from '@/lib/db';
import Order from '@/models/Order';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const PUT = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await req.json();
    const { status, trackingNumber, shippingCarrier, trackingUrl } = body;

    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const $set: Record<string, unknown> = {};
    if (status) $set.status = status;
    if (trackingNumber !== undefined) $set.trackingNumber = trackingNumber;
    if (shippingCarrier !== undefined) $set.shippingCarrier = shippingCarrier;
    if (trackingUrl !== undefined) $set.trackingUrl = trackingUrl;

    if (Object.keys($set).length === 0) {
      return errorResponse('No fields to update', 400);
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { $set },
      { new: true }
    ).populate('user', 'name email').lean();

    if (!order) return errorResponse('Order not found', 404);
    return successResponse(order);
  } catch (err) {
    console.error('[updateOrder]', err);
    return errorResponse('Failed to update order', 500);
  }
});

export const GET = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const order = await Order.findById(id).populate('user', 'name email').lean();
    if (!order) return errorResponse('Order not found', 404);
    return successResponse(order);
  } catch (err) {
    console.error('[getOrder]', err);
    return errorResponse('Failed to fetch order', 500);
  }
});