import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { deleteReview } from '@/services/review.service';

// DELETE /api/reviews/[id] — the review's own author can delete it; an
// admin can delete any review (moderation).
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const result = await deleteReview(id, req.user.userId, req.user.role === 'admin');
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to delete review', 400);
  }
});
