import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { addComment } from '@/services/blog.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const commentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  try {
    await connectDB();
    const { slug } = await params;
    const body = await req.json();

    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);

    const comment = await addComment(slug, req.user.userId, req.user.email.split('@')[0], parsed.data.message);
    return successResponse(comment, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add comment';
    return errorResponse(msg, 500);
  }
});