import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { errorResponse } from '@/lib/api-response';
import { unlinkGoogleFromUser } from '@/services/google-auth.service';

/** POST /api/auth/google/unlink — disconnect Google from the signed-in account. */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const user = await unlinkGoogleFromUser(req.user.userId);
    return NextResponse.json({ success: true, data: { user } });
  } catch (err) {
    console.error('[google-unlink]', err);
    return errorResponse(err instanceof Error ? err.message : 'Could not disconnect Google.', 400);
  }
});
