import { connectDB } from '@/lib/db';
import { sendTestEmail } from '@/services/newsletter.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { campaignInputSchema } from '@/lib/newsletter-schema';
import { z } from 'zod';

const bodySchema = z.object({
  campaign: campaignInputSchema,
  to: z.string().email('Enter a valid email address'),
  name: z.string().max(120).optional(),
});

/** Sends one copy of the current (possibly unsaved) campaign to an inbox. */
export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      const first = Object.values(fe).flat()[0];
      return errorResponse(first ? String(first) : 'Fill in the headline, subject and message first', 400, fe);
    }
    await sendTestEmail(parsed.data.campaign, parsed.data.to, parsed.data.name);
    return successResponse({ sent: true });
  } catch (err) {
    console.error('[POST /api/admin/newsletter/test]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to send test email', 500);
  }
});
