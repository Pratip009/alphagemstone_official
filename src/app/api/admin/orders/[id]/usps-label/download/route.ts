/**
 * GET /api/admin/orders/[id]/usps-label/download
 * Streams the stored USPS label so the admin can print it directly.
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

      const usps = (order as unknown as { usps?: { labelBase64?: string; trackingNumber?: string; labelFormat?: string } }).usps;
      if (!usps?.labelBase64) {
        return errorResponse('No USPS label found. Generate one first.', 404);
      }

      const buffer = Buffer.from(usps.labelBase64, 'base64');
      const isPdf  = (usps.labelFormat ?? '').toUpperCase().includes('PDF');

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': isPdf ? 'application/pdf' : 'image/gif',
          'Content-Disposition': `inline; filename="usps-label-${usps.trackingNumber ?? id}.${isPdf ? 'pdf' : 'gif'}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (err) {
      console.error('[usps-label-download]', err);
      return errorResponse('Failed to retrieve USPS label', 500);
    }
  }
);