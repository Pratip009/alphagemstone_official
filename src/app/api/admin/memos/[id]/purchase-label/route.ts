import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminPurchaseOutboundLabel, MemoError } from '@/services/memo.service';

export const POST = withAdmin(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const memo = await adminPurchaseOutboundLabel(id, req.user.userId);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/admin/memos/[id]/purchase-label error:', err);
      return errorResponse('Failed to purchase label', 500);
    }
  }
);
