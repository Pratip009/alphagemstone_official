import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getCampaign, updateCampaign, deleteCampaign } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const updateSchema = z.object({
  title:   z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  message: z.string().min(1),
  image:   z.string().optional().default(''),
});

export const GET = withAdmin(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await connectDB();
    const campaign = await getCampaign(params.id);
    if (!campaign) return errorResponse('Campaign not found', 404);
    return successResponse(campaign);
  } catch (err) {
    console.error('[GET /api/admin/newsletter/campaigns/[id]]', err);
    return errorResponse('Failed to fetch campaign', 500);
  }
});

export const PUT = withAdmin(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const campaign = await updateCampaign(params.id, parsed.data);
    return successResponse(campaign);
  } catch (err) {
    console.error('[PUT /api/admin/newsletter/campaigns/[id]]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to update campaign', 500);
  }
});

export const DELETE = withAdmin(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await connectDB();
    await deleteCampaign(params.id);
    return successResponse({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/admin/newsletter/campaigns/[id]]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to delete campaign', 500);
  }
});
