import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { subscriberStats, campaignStats } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async (_req: NextRequest) => {
  try {
    await connectDB();
    const [subs, camps] = await Promise.all([subscriberStats(), campaignStats()]);
    return successResponse({
      totalSubscribers:  subs.total,
      activeSubscribers: subs.active,
      totalCampaigns:    camps.total,
      lastSentCampaign:  camps.lastSent,
    });
  } catch (err) {
    console.error('[GET /api/admin/newsletter/stats]', err);
    return errorResponse('Failed to fetch stats', 500);
  }
});
