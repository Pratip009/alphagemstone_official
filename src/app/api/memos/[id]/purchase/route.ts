import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { purchaseMemo, MemoError } from '@/services/memo.service';

export const POST = withAuth(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const memo = await purchaseMemo(id, req.user.userId);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/memos/[id]/purchase error:', err);
      return errorResponse('Failed to purchase memo', 500);
    }
  }
);
