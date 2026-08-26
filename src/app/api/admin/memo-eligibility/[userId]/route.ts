import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminUpdateEligibility, MemoError } from '@/services/memo.service';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), creditLimit: z.number().positive() }),
  z.object({ action: z.literal('deny') }),
  z.object({ action: z.literal('suspend'), reason: z.string().optional() }),
]);

export const PUT = withAdmin(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: { userId: string } }) => {
    try {
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

      const user = await adminUpdateEligibility(params.userId, req.user.userId, parsed.data);
      return successResponse(
        { userId: user._id, memoStatus: user.memoStatus, memoCreditLimit: user.memoCreditLimit },
        200
      );
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('PUT /api/admin/memo-eligibility/[userId] error:', err);
      return errorResponse('Failed to update eligibility', 500);
    }
  }
);
