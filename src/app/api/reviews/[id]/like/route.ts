import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { toggleReviewLike } from '@/services/review.service';

// POST /api/reviews/[id]/like — toggles the caller's "helpful" reaction on
// a review. One reaction per user, on/off.
export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const result = await toggleReviewLike(id, req.user.userId);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update reaction', 400);
  }
});
