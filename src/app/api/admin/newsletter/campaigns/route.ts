import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { listCampaigns, createCampaign } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { paginatedResponse, successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const createCampaignSchema = z.object({
  title:   z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  message: z.string().min(1),
  image:   z.string().optional().default(''),
});

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get('page')  ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '10', 10);

    const { campaigns, total } = await listCampaigns({ page, limit });
    return paginatedResponse(campaigns, total, page, limit);
  } catch (err) {
    console.error('[GET /api/admin/newsletter/campaigns]', err);
    return errorResponse('Failed to fetch campaigns', 500);
  }
});

export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const campaign = await createCampaign({
      ...parsed.data,
      createdBy: req.user.userId,
    });

    return successResponse(campaign, 201);
  } catch (err) {
    console.error('[POST /api/admin/newsletter/campaigns]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to create campaign', 500);
  }
});
