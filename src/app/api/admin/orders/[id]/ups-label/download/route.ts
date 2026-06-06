/**
 * GET /api/admin/orders/[id]/ups-label/download
 * Streams the stored UPS label so the admin can print it directly.
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

      const ups = (order as unknown as { ups?: { labelBase64?: string; trackingNumber?: string; labelFormat?: string } }).ups;
      if (!ups?.labelBase64) {
        return errorResponse('No UPS label found. Generate one first.', 404);
      }

      const buffer = Buffer.from(ups.labelBase64, 'base64');
      const isGif  = (ups.labelFormat ?? 'GIF').toUpperCase() === 'GIF';

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': isGif ? 'image/gif' : 'application/pdf',
          'Content-Disposition': `inline; filename="ups-label-${ups.trackingNumber ?? id}.${isGif ? 'gif' : 'pdf'}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (err) {
      console.error('[ups-label-download]', err);
      return errorResponse('Failed to retrieve UPS label', 500);
    }
  }
);