import { connectDB } from '@/lib/db';
import Product from '@/models/Product';
import User from '@/models/User';
import Category from '@/models/Category';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async () => {
  try {
    await connectDB();

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

    const [
      totalProducts,
      activeProducts,
      newProductsThisMonth,
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      totalCategories,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Category.countDocuments({ isActive: true }),
    ]);

    // User growth %
    const userGrowth = newUsersLastMonth === 0
      ? 100
      : Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100);

    return successResponse({
      products: { total: totalProducts, active: activeProducts, newThisMonth: newProductsThisMonth },
      users:    { total: totalUsers, newThisMonth: newUsersThisMonth, growth: userGrowth },
      categories: { total: totalCategories },
    });
  } catch (err) {
    console.error('[GET /api/admin/stats]', err);
    return errorResponse('Failed to fetch stats', 500);
  }
});