/**
 * POST /api/admin/orders/[id]/fedex-label
 *
 * Admin-only. Generates (or regenerates) a FedEx shipping label for an order.
 * Use this when auto-generation failed after PayPal capture, or when you need
 * to reprint a label.
 *
 * Response includes:
 *   - Updated order document
 *   - trackingNumber
 *   - labelBase64  (PDF, base64 — decode and open in browser or print)
 */

import { connectDB } from '@/lib/db';
import { generateFedExLabel } from '@/services/order.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAdmin(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      const order = await generateFedExLabel(id);
      return successResponse({
        order,
        trackingNumber: (order as Record<string, unknown> & { fedex?: { trackingNumber: string } })?.fedex?.trackingNumber,
        labelBase64: (order as Record<string, unknown> & { fedex?: { labelBase64: string } })?.fedex?.labelBase64,
        message: 'FedEx label generated successfully',
      });
    } catch (err) {
      console.error('[fedex-label]', err);
      return errorResponse(
        err instanceof Error ? err.message : 'Failed to generate FedEx label',
        500
      );
    }
  }
);