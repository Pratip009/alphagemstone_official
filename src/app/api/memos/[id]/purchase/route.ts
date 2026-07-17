import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { purchaseMemo, MemoError } from '@/services/memo.service';

export const POST = withAuth(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: { id: string } }) => {
    try {
      const memo = await purchaseMemo(params.id, req.user.userId);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/memos/[id]/purchase error:', err);
      return errorResponse('Failed to purchase memo', 500);
    }
  }
);
