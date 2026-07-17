import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminGetStats } from '@/services/memo.service';

export const GET = withAdmin(async (_req: NextRequest) => {
  try {
    const stats = await adminGetStats();
    return successResponse(stats, 200);
  } catch (err) {
    console.error('GET /api/admin/memos/stats error:', err);
    return errorResponse('Failed to fetch memo stats', 500);
  }
});
