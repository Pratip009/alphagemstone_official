/**
 * GET /api/orders/[id]/tracking
 *
 * Works for a logged-in user, a guest (via their guest_id cookie), or an
 * admin. Non-admins can only view their own order (identity filter applied);
 * admins see all orders.
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
import { withCartAuth, CartAuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withCartAuth(
  async (req: CartAuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      // Admins see any order; everyone else (logged-in or guest) only theirs.
      const identity = req.user?.role === 'admin' ? undefined : req.identity;
      const tracking = await getOrderTracking(id, identity);

      return successResponse(tracking);
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Failed to fetch tracking info',
        500
      );
    }
  }
);
