import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { replyToReview, removeReviewReply } from '@/services/review.service';

// POST /api/admin/reviews/[id]/reply — { text } — post (or overwrite) the
// store's reply to a customer review.
export const POST = withAdmin(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const { text } = await req.json();
    const review = await replyToReview(id, req.user.userId, text);
    return successResponse(review);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to post reply', 400);
  }
});

// DELETE /api/admin/reviews/[id]/reply — retract the store's reply.
export const DELETE = withAdmin(async (_req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const review = await removeReviewReply(id);
    return successResponse(review);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to remove reply', 400);
  }
});
