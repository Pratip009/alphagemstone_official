import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { updateProduct, deleteProduct } from '@/services/product.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const PUT = withAdmin(async (req, { params }) => {
  try {
    await connectDB();
    const body = await req.json();
    const updated = await updateProduct(params.id, body);
    if (!updated) return errorResponse('Product not found', 404);
    return successResponse(updated);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Update failed', 500);
  }
});

export const DELETE = withAdmin(async (_req, { params }) => {
  try {
    await connectDB();
    const deleted = await deleteProduct(params.id);
    if (!deleted) return errorResponse('Product not found', 404);
    return successResponse({ message: 'Product deactivated' });
  } catch (err) {
    return errorResponse('Delete failed', 500);
  }
});
