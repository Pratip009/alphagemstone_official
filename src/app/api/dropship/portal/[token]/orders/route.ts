import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { submitDropshipOrder, DropshipError } from '@/services/dropship.service';

const schema = z.object({
  productId: z.string().min(1, 'Please select a product'),
  quantity: z.number().int().positive().optional(),
  specifications: z.string().optional(),
  customerName: z.string().min(2, "Customer's name is required"),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  addressLine1: z.string().min(2, 'Shipping address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().optional(),
  shippingMethod: z.string().optional(),
  specialInstructions: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const rate = await rateLimit(req, {
      id: 'dropship-order-submit',
      limit: 30,
      windowSec: 3600,
      extraKey: token,
      scope: 'key',
    });
    if (!rate.success) return rateLimitResponse(rate);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'Invalid request',
        422,
        parsed.error.flatten().fieldErrors
      );
    }

    const order = await submitDropshipOrder(token, parsed.data);
    return successResponse(
      { orderId: order._id, status: order.status, amount: order.amount },
      201
    );
  } catch (err) {
    if (err instanceof DropshipError) return errorResponse(err.message, err.status);
    console.error('POST /api/dropship/portal/[token]/orders error:', err);
    return errorResponse('Failed to submit order', 500);
  }
}
