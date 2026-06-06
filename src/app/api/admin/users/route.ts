import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async (req) => {
  try {
    await connectDB();

    const sp = req.nextUrl.searchParams;
    const page  = Math.max(1, Number(sp.get('page')  || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 50)));
    const skip  = (page - 1) * limit;

    const [users, total, adminCount, newThisMonth] = await Promise.all([
      User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    ]);

    return successResponse({
      users,
      total,
      adminCount,
      userCount: total - adminCount,
      newThisMonth,
      page,
      limit,
    });
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    return errorResponse('Failed to fetch users', 500);
  }
});