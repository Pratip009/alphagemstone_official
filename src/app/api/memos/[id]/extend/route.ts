import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requestExtension, MemoError } from '@/services/memo.service';

const extendSchema = z.object({
  extraDays: z.number().int().min(1).max(14),
});

export const POST = withAuth(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const parsed = extendSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

      const memo = await requestExtension(id, req.user.userId, parsed.data.extraDays);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('POST /api/memos/[id]/extend error:', err);
      return errorResponse('Failed to request extension', 500);
    }
  }
);
