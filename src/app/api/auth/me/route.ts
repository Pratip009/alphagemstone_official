import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getUserById, toPublicUser } from '@/services/auth.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const user = await getUserById(req.user.userId);
    if (!user) return errorResponse('User not found', 404);
    // Normalize to the same shape returned by login/signup/account update.
    return successResponse(toPublicUser(user));
  } catch {
    return errorResponse('Failed to get user', 500);
  }
});