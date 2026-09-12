import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPipelineCounts } from '@/services/dropship.service';

async function handler(req: NextRequest) {
  try {
    const pipeline = await getPipelineCounts();
    return successResponse(pipeline);
  } catch (err) {
    console.error('GET /api/admin/dropship/pipeline error:', err);
    return errorResponse('Failed to load pipeline', 500);
  }
}

export const GET = withAdmin(handler);
