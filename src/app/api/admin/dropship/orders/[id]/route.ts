import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminUpdateOrder, DropshipError } from '@/services/dropship.service';

const schema = z.object({
  status: z
    .enum(['pending_payment', 'processing', 'shipped', 'delivered', 'cancelled'])
    .optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  adminNotes: z.string().optional(),
});

export const PUT = withAdmin(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid request',
          400,
          parsed.error.flatten().fieldErrors
        );
      }

      const order = await adminUpdateOrder(id, parsed.data);
      return successResponse({ orderId: order._id, status: order.status });
    } catch (err) {
      if (err instanceof DropshipError) return errorResponse(err.message, err.status);
      console.error('PUT /api/admin/dropship/orders/[id] error:', err);
      return errorResponse('Failed to update order', 500);
    }
  }
);
