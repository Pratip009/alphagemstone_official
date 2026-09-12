import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminListOrders } from '@/services/dropship.service';

async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);

    const result = await adminListOrders({ status, page });
    return successResponse(result);
  } catch (err) {
    console.error('GET /api/admin/dropship/orders error:', err);
    return errorResponse('Failed to load orders', 500);
  }
}

export const GET = withAdmin(handler);
