import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { toggleLike } from '@/services/blog.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  try {
    await connectDB();
    const { slug } = await params;
    const result = await toggleLike(slug, req.user.userId);
    return successResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to toggle like';
    const status = msg === 'Blog not found' ? 404 : 500;
    return errorResponse(msg, status);
  }
});