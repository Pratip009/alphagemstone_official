import { connectDB } from '@/lib/db';
import { getWishlist, addToWishlist, removeFromWishlist, clearWishlist } from '@/services/wishlist.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const wishlist = await getWishlist(req.user.userId);
    return successResponse({ wishlist });
  } catch {
    return errorResponse('Failed to fetch wishlist', 500);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { productId } = await req.json();
    if (!productId) return errorResponse('productId is required', 400);
    const wishlist = await addToWishlist(req.user.userId, productId);
    return successResponse({ wishlist }, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to add to wishlist', 400);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const productId = req.nextUrl.searchParams.get('productId');
    const clearAll = req.nextUrl.searchParams.get('all') === 'true';

    if (clearAll) {
      const wishlist = await clearWishlist(req.user.userId);
      return successResponse({ wishlist });
    }

    if (!productId) return errorResponse('productId is required', 400);
    const wishlist = await removeFromWishlist(req.user.userId, productId);
    return successResponse({ wishlist });
  } catch {
    return errorResponse('Failed to remove from wishlist', 500);
  }
});