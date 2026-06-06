/**
 * POST /api/admin/orders/[id]/ups-label
 * Admin-only. Generates (or regenerates) a UPS shipping label for an order.
 * Requires payment to be completed and valid UPS OAuth credentials.
 */
import { connectDB } from '@/lib/db';
import { generateUpsLabel } from '@/services/order.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAdmin(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      const order = await generateUpsLabel(id);
      const ups = (order as Record<string, unknown> & { ups?: { trackingNumber?: string; labelBase64?: string } })?.ups;

      return successResponse({
        order,
        trackingNumber: ups?.trackingNumber,
        labelBase64:    ups?.labelBase64,
        message: 'UPS label generated successfully',
      });
    } catch (err) {
      console.error('[ups-label]', err);
      return errorResponse(
        err instanceof Error ? err.message : 'Failed to generate UPS label',
        500
      );
    }
  }
);