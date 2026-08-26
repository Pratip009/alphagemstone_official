import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getCart, addToCart, updateCartItem, removeFromCart, calculateCartTotals } from '@/services/cart.service';
import { withCartAuth, CartAuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const cart = await getCart(req.identity);
    const cartDoc = cart as unknown as { items: Array<{ price: number; quantity: number }> } | null;
    const items = cartDoc?.items || [];
    const totals = calculateCartTotals(items);
    return successResponse({ cart, totals });
  } catch {
    return errorResponse('Failed to fetch cart', 500);
  }
});

export const POST = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const { productId, quantity = 1 } = await req.json();
    if (!productId) return errorResponse('productId is required', 400);
    const cart = await addToCart(req.identity, productId, quantity);
    return successResponse(cart, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to add to cart', 400);
  }
});

export const PUT = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const { productId, quantity } = await req.json();
    if (!productId || quantity === undefined) return errorResponse('productId and quantity required', 400);
    const cart = await updateCartItem(req.identity, productId, quantity);
    return successResponse(cart);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update cart', 400);
  }
});

export const DELETE = withCartAuth(async (req: CartAuthenticatedRequest) => {
  try {
    await connectDB();
    const productId = req.nextUrl.searchParams.get('productId');
    if (!productId) return errorResponse('productId is required', 400);
    const cart = await removeFromCart(req.identity, productId);
    return successResponse(cart);
  } catch {
    return errorResponse('Failed to remove from cart', 500);
  }
});
