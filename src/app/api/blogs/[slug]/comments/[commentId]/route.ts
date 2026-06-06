import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { editComment, deleteComment } from '@/services/blog.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const editSchema = z.object({
  message: z.string().min(1).max(2000),
});

type Params = { params: Promise<{ slug: string; commentId: string }> };

export const PUT = withAuth(async (req: AuthenticatedRequest, { params }: Params) => {
  try {
    await connectDB();
    const { slug, commentId } = await params;
    const body = await req.json();

    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Validation failed', 400);

    await editComment(slug, commentId, req.user.userId, parsed.data.message);
    return successResponse({ message: 'Comment updated' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to edit comment';
    const status = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 500;
    return errorResponse(msg, status);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: Params) => {
  try {
    await connectDB();
    const { slug, commentId } = await params;
    await deleteComment(slug, commentId, req.user.userId, req.user.role === 'admin');
    return successResponse({ message: 'Comment deleted' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete comment';
    const status = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 500;
    return errorResponse(msg, status);
  }
});