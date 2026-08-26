import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getUserById } from '@/services/auth.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const user = await getUserById(req.user.userId);
    if (!user) return errorResponse('User not found', 404);
    // Normalize to the same { id, name, email, role } shape returned by
    // login/signup, since this is a lean() Mongoose doc (still has _id).
    return successResponse({
      id: (user as any)._id?.toString?.() ?? (user as any)._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch {
    return errorResponse('Failed to get user', 500);
  }
});
