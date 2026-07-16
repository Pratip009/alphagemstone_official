import { connectDB } from '@/lib/db';
import { toggleWishlist } from '@/services/wishlist.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { productId } = await req.json();
    if (!productId) return errorResponse('productId is required', 400);
    const { wishlist, inWishlist } = await toggleWishlist(req.user.userId, productId);
    return successResponse({ wishlist, inWishlist });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update wishlist', 400);
  }
});