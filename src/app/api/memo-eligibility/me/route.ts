import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import User from '@/models/User';

// GET /api/memo-eligibility/me — lets the logged-in customer check their own
// memo trade-vetting status (none | pending | approved | suspended) without
// needing admin access. Used by the "Memo Program" account page to decide
// whether to show the application form or the request-a-memo flow.
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const user = await User.findById(req.user.userId).select(
      'memoStatus memoCreditLimit memoBusinessName memoResaleCertNumber memoSuspendedReason'
    );
    if (!user) return errorResponse('User not found', 404);

    return successResponse({
      memoStatus: user.memoStatus,
      memoCreditLimit: user.memoCreditLimit,
      memoBusinessName: user.memoBusinessName ?? null,
      memoResaleCertNumber: user.memoResaleCertNumber ?? null,
      memoSuspendedReason: user.memoSuspendedReason ?? null,
    });
  } catch (err) {
    console.error('GET /api/memo-eligibility/me error:', err);
    return errorResponse('Failed to fetch memo eligibility status', 500);
  }
});
