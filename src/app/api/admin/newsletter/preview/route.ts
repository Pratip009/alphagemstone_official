import { connectDB } from '@/lib/db';
import { renderPreview } from '@/services/newsletter.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { campaignDraftSchema } from '@/lib/newsletter-schema';
import { z } from 'zod';

const bodySchema = z.object({
  campaign: campaignDraftSchema,
  recipient: z.object({
    name: z.string().max(120).optional(),
    source: z.enum(['website', 'legacy', 'user']).optional(),
  }).optional(),
});

/** Renders the exact HTML a recipient would get, for the editor's live preview. */
export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    const html = renderPreview(parsed.data.campaign, parsed.data.recipient);
    return successResponse({ html });
  } catch (err) {
    console.error('[POST /api/admin/newsletter/preview]', err);
    return errorResponse('Failed to render preview', 500);
  }
});
