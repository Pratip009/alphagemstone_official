import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withAdmin } from '@/middleware/auth.middleware';
import { listReviewsAdmin } from '@/services/review.service';

// GET /api/admin/reviews?page=1&productId=&hasReply=yes|no
export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const productId = searchParams.get('productId') || undefined;
    const hasReplyParam = searchParams.get('hasReply');
    const hasReply = hasReplyParam === 'yes' || hasReplyParam === 'no' ? hasReplyParam : undefined;

    const result = await listReviewsAdmin({ page, productId, hasReply });
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to load reviews', 400);
  }
});
