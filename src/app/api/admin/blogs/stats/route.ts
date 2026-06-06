import { connectDB } from '@/lib/db';
import { getBlogStats } from '@/services/blog.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async () => {
  try {
    await connectDB();
    const stats = await getBlogStats();
    return successResponse(stats);
  } catch (err) {
    console.error('[GET /api/admin/blogs/stats]', err);
    return errorResponse('Failed to fetch blog stats', 500);
  }
});