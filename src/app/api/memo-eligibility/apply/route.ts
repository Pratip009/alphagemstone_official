import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';
import { applyForMemoEligibility, MemoError } from '@/services/memo.service';

const applySchema = z.object({
  businessName: z.string().min(1),
  resaleCertNumber: z.string().optional(),
  references: z.string().optional(),
});

export const POST = withAuth(async (req: NextRequest & { user: { userId: string } }) => {
  try {
    const rate = await checkRateLimit(`memo-apply:${req.user.userId}`, { max: 3, windowSeconds: 86400 });
    if (!rate.allowed) return errorResponse('Too many applications — please try again tomorrow', 429);

    const body = await req.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

    const user = await applyForMemoEligibility(req.user.userId, parsed.data);
    return successResponse({ memoStatus: user.memoStatus }, 200);
  } catch (err) {
    if (err instanceof MemoError) return errorResponse(err.message, err.status);
    console.error('POST /api/memo-eligibility/apply error:', err);
    return errorResponse('Failed to submit application', 500);
  }
});
