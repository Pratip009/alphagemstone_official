import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createOrderFromCart, getUserOrders } from '@/services/order.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const shippingSchema = z.object({
  fullName: z.string().min(2),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().min(2),
  phone: z.string().optional(),
});

const createOrderSchema = z.object({
  shippingAddress: shippingSchema,
  paymentMethod: z.enum(['paypal', 'cod']),
});

// POST /api/orders
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const order = await createOrderFromCart(
      req.user.userId,
      parsed.data.shippingAddress,
      parsed.data.paymentMethod
    );

    return successResponse(order, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to create order', 400);
  }
});

// GET /api/orders
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const orders = await getUserOrders(req.user.userId);
    return successResponse(orders);
  } catch {
    return errorResponse('Failed to fetch orders', 500);
  }
});
