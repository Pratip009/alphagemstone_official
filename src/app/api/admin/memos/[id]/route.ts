import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  adminGetMemo,
  adminApprove,
  adminReject,
  adminApproveExtension,
  adminAddNote,
  MemoError,
} from '@/services/memo.service';

export const GET = withAdmin(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const memo = await adminGetMemo(params.id);
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('GET /api/admin/memos/[id] error:', err);
      return errorResponse('Failed to fetch memo', 500);
    }
  }
);

const putSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), note: z.string().optional() }),
  z.object({ action: z.literal('reject'), reason: z.string().min(1) }),
  z.object({ action: z.literal('extend'), extraDays: z.number().int().min(1).max(14), note: z.string().optional() }),
  z.object({ action: z.literal('note'), note: z.string().min(1) }),
]);

export const PUT = withAdmin(
  async (req: NextRequest & { user: { userId: string } }, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = putSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);

      const adminId = req.user.userId;
      let memo;
      switch (parsed.data.action) {
        case 'approve':
          memo = await adminApprove(params.id, adminId, parsed.data.note);
          break;
        case 'reject':
          memo = await adminReject(params.id, adminId, parsed.data.reason);
          break;
        case 'extend':
          memo = await adminApproveExtension(params.id, adminId, parsed.data.extraDays, parsed.data.note);
          break;
        case 'note':
          memo = await adminAddNote(params.id, adminId, parsed.data.note);
          break;
      }
      return successResponse(memo, 200);
    } catch (err) {
      if (err instanceof MemoError) return errorResponse(err.message, err.status);
      console.error('PUT /api/admin/memos/[id] error:', err);
      return errorResponse('Failed to update memo', 500);
    }
  }
);
