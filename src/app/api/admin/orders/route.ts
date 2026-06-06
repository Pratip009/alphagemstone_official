import { connectDB } from '@/lib/db';
import { getAllOrders } from '@/services/order.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { errorResponse } from '@/lib/api-response';

export const GET = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 20);
    const status = searchParams.get('status') || undefined;

    const { orders, total } = await getAllOrders(page, limit, status);
    const totalPages = Math.ceil(total / limit);

    return Response.json({
      success: true,
      data: orders,
      pagination: { total, page, limit, totalPages },
    });
  } catch (err) {
    console.error('[getAllOrders]', err);
    return errorResponse('Failed to fetch orders', 500);
  }
});