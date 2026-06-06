/**
 * GET /api/orders/[id]/tracking
 *
 * Authenticated (customer or admin). Returns live FedEx tracking data
 * for the order.  Customers can only view their own orders (userId filter
 * is applied); admins see all orders.
 *
 * Response:
 *   {
 *     trackingNumber, status, statusDescription,
 *     estimatedDelivery, actualDelivery,
 *     events: [{ timestamp, eventType, description, location }]
 *   }
 */

import { connectDB } from '@/lib/db';
import { getOrderTracking } from '@/services/order.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      // Admins see any order; regular users only their own
      const userId = req.user.role === 'admin' ? undefined : req.user.userId;
      const tracking = await getOrderTracking(id, userId);

      return successResponse(tracking);
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Failed to fetch tracking info',
        500
      );
    }
  }
);