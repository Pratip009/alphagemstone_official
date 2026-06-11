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
  shippingAddress:  shippingSchema,
  paymentMethod:    z.enum(['paypal', 'cod']),
  couponCode:       z.string().optional(),
  // ShipEngine shipping selection saved at checkout
  shippingCarrier:           z.string().optional(),
  shippingService:           z.string().optional(),
  shippingServiceCode:       z.string().nullable().optional(),
  shippingRateId:            z.string().nullable().optional(),
  shippingRate:              z.number().optional(),
  shippingEstimatedDays:     z.number().nullable().optional(),
  shippingEstimatedDelivery: z.string().nullable().optional(),
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

    const {
      shippingAddress,
      paymentMethod,
      couponCode,
      shippingCarrier,
      shippingService,
      shippingServiceCode,
      shippingRateId,
      shippingRate,
      shippingEstimatedDays,
      shippingEstimatedDelivery,
    } = parsed.data;

    const shippingSelection = (shippingCarrier || shippingRateId) ? {
      shippingCarrier,
      shippingService,
      shippingServiceCode: shippingServiceCode ?? undefined,
      shippingRateId:      shippingRateId      ?? undefined,
      shippingRate,
      shippingEstimatedDays:     shippingEstimatedDays     ?? undefined,
      shippingEstimatedDelivery: shippingEstimatedDelivery ?? undefined,
    } : undefined;

    const order = await createOrderFromCart(
      req.user.userId,
      shippingAddress,
      paymentMethod,
      couponCode,
      shippingSelection
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