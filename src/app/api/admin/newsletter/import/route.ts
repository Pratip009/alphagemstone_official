import { connectDB } from '@/lib/db';
import { importLegacyContacts } from '@/services/newsletter.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const bodySchema = z.object({
  contacts: z
    .array(z.object({ email: z.string().max(320), name: z.string().max(300).optional() }))
    .min(1)
    .max(2000),
});

/** Adds old-website contacts to the newsletter list (source 'legacy').
 *  The admin page sends large files in chunks of up to 2,000 rows. */
export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Send between 1 and 2,000 contacts per request', 400);
    const result = await importLegacyContacts(parsed.data.contacts);
    return successResponse(result);
  } catch (err) {
    console.error('[POST /api/admin/newsletter/import]', err);
    return errorResponse('Failed to import contacts', 500);
  }
});
