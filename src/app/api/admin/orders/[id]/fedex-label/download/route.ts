/**
 * GET /api/admin/orders/[id]/fedex-label
 *
 * Admin-only. Streams the FedEx label PDF so the admin can print it directly
 * from the browser without any extra decoding.
 *
 * Usage: open this URL in a new browser tab or trigger via window.open().
 */

import { connectDB } from '@/lib/db';
import Order from '@/models/Order';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { errorResponse } from '@/lib/api-response';

export const GET = withAdmin(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      await connectDB();
      const { id } = params;
      if (!id) return errorResponse('Order ID is required', 400);

      const order = await Order.findById(id).lean();
      if (!order) return errorResponse('Order not found', 404);

      const fedex = (order as unknown as { fedex?: { labelBase64?: string; trackingNumber?: string } }).fedex;
      if (!fedex?.labelBase64) {
        return errorResponse('No FedEx label found. Generate one first.', 404);
      }

      const pdfBuffer = Buffer.from(fedex.labelBase64, 'base64');

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="fedex-label-${fedex.trackingNumber ?? id}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } catch (err) {
      console.error('[fedex-label-download]', err);
      return errorResponse('Failed to retrieve label', 500);
    }
  }
);