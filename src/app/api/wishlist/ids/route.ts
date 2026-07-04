import { connectDB } from '@/lib/db';
import { getWishlistProductIds } from '@/services/wishlist.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const productIds = await getWishlistProductIds(req.user.userId);
    return successResponse({ productIds });
  } catch {
    return errorResponse('Failed to fetch wishlist ids', 500);
  }
});