import { connectDB } from '@/lib/db';
import { moveToCart } from '@/services/wishlist.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { productId, quantity = 1 } = await req.json();
    if (!productId) return errorResponse('productId is required', 400);
    const cart = await moveToCart(req.user.userId, productId, quantity);
    return successResponse({ cart });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to move item to cart', 400);
  }
});