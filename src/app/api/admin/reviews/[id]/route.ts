import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { setReviewVisibility, deleteReview } from '@/services/review.service';

// PATCH /api/admin/reviews/[id] — { isHidden: boolean } to hide/unhide a
// review from the storefront without deleting it.
export const PATCH = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const { isHidden } = await req.json();
    if (typeof isHidden !== 'boolean') return errorResponse('isHidden must be a boolean', 400);
    const review = await setReviewVisibility(id, isHidden);
    return successResponse(review);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update review', 400);
  }
});

// DELETE /api/admin/reviews/[id] — permanently remove a review (spam/abuse).
export const DELETE = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const result = await deleteReview(id, req.user.userId, true);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to delete review', 400);
  }
});
