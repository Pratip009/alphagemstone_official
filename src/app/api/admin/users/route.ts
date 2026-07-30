import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Order from '@/models/Order';
import AnalyticsSession from '@/models/AnalyticsSession';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async (req) => {
  try {
    await connectDB();

    const sp = req.nextUrl.searchParams;
    const page   = Math.max(1, Number(sp.get('page')  || 1));
    const limit  = Math.min(100, Math.max(1, Number(sp.get('limit') || 50)));
    const search = (sp.get('search') || '').trim();
    const skip   = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [users, total, filteredTotal, adminCount, newThisMonth] = await Promise.all([
      User.find(filter)
        .select('name email role phone createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(),
      User.countDocuments(filter),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    ]);

    const userIds = users.map((u) => u._id);
    const userIdStrings = userIds.map((id) => id.toString());

    // ── Purchases: total spent (paid orders only) + order count per user ──
    const purchaseAgg = userIds.length
      ? await Order.aggregate([
          { $match: { user: { $in: userIds } } },
          {
            $group: {
              _id: '$user',
              orderCount: { $sum: 1 },
              totalSpent: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$totalAmount', 0],
                },
              },
              lastOrderAt: { $max: '$createdAt' },
            },
          },
        ])
      : [];
    const purchaseMap = new Map(purchaseAgg.map((p) => [p._id.toString(), p]));

    // ── Screen time: summed session duration (seconds) per user ──
    // Only populated for sessions recorded after a visitor was logged in —
    // see src/lib/analytics.ts. Anonymous browsing before login isn't
    // attributed to an account.
    const analyticsAgg = userIdStrings.length
      ? await AnalyticsSession.aggregate([
          { $match: { userId: { $in: userIdStrings } } },
          {
            $group: {
              _id: '$userId',
              totalScreenTime: { $sum: '$duration' },
              sessionCount: { $sum: 1 },
              lastActiveAt: { $max: '$lastActivityAt' },
            },
          },
        ])
      : [];
    const analyticsMap = new Map(analyticsAgg.map((a) => [a._id, a]));

    const enrichedUsers = users.map((u) => {
      const idStr = u._id.toString();
      const purchases = purchaseMap.get(idStr);
      const analytics = analyticsMap.get(idStr);
      return {
        ...u,
        orderCount: purchases?.orderCount ?? 0,
        totalSpent: purchases?.totalSpent ?? 0,
        lastOrderAt: purchases?.lastOrderAt ?? null,
        totalScreenTime: analytics?.totalScreenTime ?? 0,
        sessionCount: analytics?.sessionCount ?? 0,
        lastActiveAt: analytics?.lastActiveAt ?? null,
      };
    });

    return successResponse({
      users: enrichedUsers,
      total: filteredTotal,
      grandTotal: total,
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