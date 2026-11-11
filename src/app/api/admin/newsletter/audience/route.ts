import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { audienceSummary } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

/** GET ?subscribers=1&users=1&legacy=1 → how many unique people that would reach. */
export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const on = (k: string) => sp.get(k) === '1' || sp.get(k) === 'true';
    const summary = await audienceSummary({
      subscribers: on('subscribers'),
      users: on('users'),
      legacy: on('legacy'),
    });
    return successResponse(summary);
  } catch (err) {
    console.error('[GET /api/admin/newsletter/audience]', err);
    return errorResponse('Failed to count audience', 500);
  }
});
