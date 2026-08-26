import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminMarkReturned, MemoError } from '@/services/memo.service';

const schema = z.object({
  condition: z.enum(['ok', 'damaged']),
  note: z.string().optional(),
});

export const POST = withAdmin(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

      const memo = await adminMarkReturned(id, req.user.userId, parsed.data.condition, parsed.data.note);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/admin/memos/[id]/mark-returned error:', err);
      return errorResponse('Failed to mark memo returned', 500);
    }
  }
);
