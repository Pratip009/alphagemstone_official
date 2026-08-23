import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAuth, withOptionalAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import {
  listProductReviews,
  createOrUpdateReview,
  getMyReviewForProduct,
  type ReviewSort,
} from '@/services/review.service';

const SORTS = new Set(['newest', 'oldest', 'highest', 'lowest', 'helpful']);

// GET /api/products/[id]/reviews?page=1&sort=newest
// Public — anyone can read reviews. When the visitor is logged in, each
// review also comes back annotated with whether *they* have liked it, and
// the response includes `myReview` so the storefront can show "Edit your
// review" instead of a second "Write a review" form.
export const GET = withOptionalAuth(async (req, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const sortParam = searchParams.get('sort') || 'newest';
    const sort = (SORTS.has(sortParam) ? sortParam : 'newest') as ReviewSort;

    const viewerId = req.user?.userId;

    const [result, myReview] = await Promise.all([
      listProductReviews(id, { page, sort, viewerId }),
      viewerId ? getMyReviewForProduct(id, viewerId) : Promise.resolve(null),
    ]);

    return successResponse({ ...result, myReview });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to load reviews', 400);
  }
});

// POST /api/products/[id]/reviews — create or update the caller's own
// review for this product (one review per user per product; resubmitting
// edits it in place rather than erroring).
export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await req.json();

    const review = await createOrUpdateReview(id, req.user.userId, {
      rating: body.rating,
      title: body.title,
      comment: body.comment,
    });

    return successResponse(review, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to submit review', 400);
  }
});
