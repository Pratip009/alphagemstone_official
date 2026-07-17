import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminRecall, MemoError } from '@/services/memo.service';
const schema = z.object({ note: z.string().optional() });

export const POST = withAdmin(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const parsed = schema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

      const memo = await adminRecall(id, req.user.userId, parsed.data.note);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/admin/memos/[id]/recall error:', err);
      return errorResponse('Failed to recall memo', 500);
    }
  }
);
