/**
 * POST /api/admin/orders/[id]/usps-label
 * Admin-only. Generates (or regenerates) a USPS shipping label for an order.
 * Requires payment to be completed and a valid USPS_USER_ID with eVS access.
 */
import { connectDB } from '@/lib/db';
import { generateUspsLabel } from '@/services/order.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAdmin(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      const order = await generateUspsLabel(id);
      const usps = (order as Record<string, unknown> & { usps?: { trackingNumber?: string; labelBase64?: string } })?.usps;

      return successResponse({
        order,
        trackingNumber: usps?.trackingNumber,
        labelBase64:    usps?.labelBase64,
        message: 'USPS label generated successfully',
      });
    } catch (err) {
      console.error('[usps-label]', err);
      return errorResponse(
        err instanceof Error ? err.message : 'Failed to generate USPS label',
        500
      );
    }
  }
);