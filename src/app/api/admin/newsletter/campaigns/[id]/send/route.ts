import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { sendCampaignChunk } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

// Each call works for ~40s, then the admin page calls again until done.
export const maxDuration = 60;

export const POST = withAdmin(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    const { id } = await context.params;
    const progress = await sendCampaignChunk(id);
    return successResponse(progress);
  } catch (err) {
    console.error('[POST /api/admin/newsletter/campaigns/[id]/send]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to send campaign', 500);
  }
});
