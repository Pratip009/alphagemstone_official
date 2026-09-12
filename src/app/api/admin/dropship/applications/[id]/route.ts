import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  adminUpdateApplication,
  DropshipError,
} from '@/services/dropship.service';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().optional() }),
  z.object({ action: z.literal('deactivate') }),
  z.object({ action: z.literal('reactivate') }),
]);

export const PUT = withAdmin(
  async (
    req: NextRequest & { user: { userId: string } },
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid request',
          400,
          parsed.error.flatten().fieldErrors
        );
      }

      const application = await adminUpdateApplication(
        id,
        req.user.userId,
        parsed.data
      );
      return successResponse({
        applicationId: application._id,
        status: application.status,
        active: application.active,
      });
    } catch (err) {
      if (err instanceof DropshipError) return errorResponse(err.message, err.status);
      console.error('PUT /api/admin/dropship/applications/[id] error:', err);
      return errorResponse('Failed to update application', 500);
    }
  }
);
