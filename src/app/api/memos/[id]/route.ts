import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getMemoForUser, MemoError } from '@/services/memo.service';

export const GET = withAuth(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const memo = await getMemoForUser(id, req.user.userId);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('GET /api/memos/[id] error:', err);
      return errorResponse('Failed to fetch memo', 500);
    }
  }
);