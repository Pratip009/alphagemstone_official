import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminPurchaseDropshipLabel, DropshipError } from '@/services/dropship.service';

/**
 * POST /api/admin/dropship/orders/[id]/purchase-label
 * Manual retry for when auto-purchase-on-payment failed (e.g. a carrier
 * hiccup). No-op if a label already exists on the order.
 */
export const POST = withAdmin(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const order = await adminPurchaseDropshipLabel(id);
      return successResponse({
        orderId: order._id,
        labelId: order.labelId,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
      });
    } catch (err) {
      if (err instanceof DropshipError) return errorResponse(err.message, err.status);
      console.error('POST /api/admin/dropship/orders/[id]/purchase-label error:', err);
      return errorResponse('Failed to purchase label', 500);
    }
  }
);
