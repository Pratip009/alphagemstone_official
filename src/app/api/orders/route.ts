import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createOrderFromCart, getUserOrders } from '@/services/order.service';
import { withCartAuth, CartAuthenticatedRequest } from '@/middleware/auth.middleware';
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
  // Required when checking out as a guest (no account to source an email
  // from). Optional for logged-in users — ignored if present, since their
  // account email is used instead.
  guestEmail:       z.string().email().optional(),
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
export const POST = withCartAuth(async (req: CartAuthenticatedRequest) => {
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
      guestEmail,
      shippingCarrier,
      shippingService,
      shippingServiceCode,
      shippingRateId,
      shippingRate,
      shippingEstimatedDays,
      shippingEstimatedDelivery,
    } = parsed.data;

    // A guest checking out MUST supply an email — it's the only way to send
    // confirmation/shipping emails and the only way they can later look this
    // order up. Validated here (not just in the zod schema) since the schema
    // field is optional to accommodate logged-in users.
    if (!req.identity.userId && !guestEmail) {
      return errorResponse('Email is required to check out as a guest', 400);
    }

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
      req.identity,
      shippingAddress,
      paymentMethod,
      couponCode,
      shippingSelection,
      guestEmail
    );

    return successResponse(order, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to create order', 400);
  }
});

// GET /api/orders
// Order history is an account feature — guests have no login to list orders
// under, so this stays user-only. A guest lands on their order-confirmation
// page right after checkout instead (GET /api/orders/[id], identity-scoped).
export const GET = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    if (!req.identity.userId) {
      return errorResponse('Sign in to view your order history', 401);
    }
    await connectDB();
    const orders = await getUserOrders(req.identity.userId);
    return successResponse(orders);
  } catch {
    return errorResponse('Failed to fetch orders', 500);
  }
});
