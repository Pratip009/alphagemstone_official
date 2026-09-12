import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { listOrdersForToken } from '@/services/dropship.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await listOrdersForToken(token);
    if (!result) return errorResponse('Portal link not found', 404);

    const { application, orders } = result;
    return successResponse({
      application: {
        fullName: application.fullName,
        businessName: application.businessName,
        email: application.email,
        status: application.status,
        createdAt: application.createdAt,
      },
      orders,
    });
  } catch (err) {
    console.error('GET /api/dropship/portal/[token] error:', err);
    return errorResponse('Failed to load portal', 500);
  }
}
