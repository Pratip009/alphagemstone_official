import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminListMemos } from '@/services/memo.service';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = await adminListMemos({
      status: searchParams.get('status') ?? undefined,
      overdueOnly: searchParams.get('overdueOnly') === 'true',
      userId: searchParams.get('userId') ?? undefined,
      productId: searchParams.get('productId') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });
    return successResponse(result, 200);
  } catch (err) {
    console.error('GET /api/admin/memos error:', err);
    return errorResponse('Failed to fetch memos', 500);
  }
});
