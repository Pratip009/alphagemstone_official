import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { sendCampaign } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAdmin(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await connectDB();
    const result = await sendCampaign(params.id);
    return successResponse(result);
  } catch (err) {
    console.error('[POST /api/admin/newsletter/campaigns/[id]/send]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to send campaign', 500);
  }
});
