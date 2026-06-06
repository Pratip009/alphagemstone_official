import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { addReply } from '@/services/blog.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import User from '@/models/User';

const replySchema = z.object({
  message: z.string().min(1).max(1000),
});

type Params = { params: Promise<{ slug: string; commentId: string }> };

export const POST = withAuth(async (req: AuthenticatedRequest, { params }: Params) => {
  try {
    await connectDB();
    const { slug, commentId } = await params;
    const body = await req.json();

    const parsed = replySchema.safeParse(body);
    if (!parsed.success) return errorResponse('Validation failed', 400);

    // Fetch real user name
    const user = await User.findById(req.user.userId).select('name').lean();
    const userName = (user as { name?: string } | null)?.name ?? req.user.email.split('@')[0];

    const updated = await addReply(
      slug,
      commentId,
      req.user.userId,
      userName,
      parsed.data.message,
      req.user.role === 'admin'
    );

    return successResponse(updated, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add reply';
    return errorResponse(msg, 500);
  }
});