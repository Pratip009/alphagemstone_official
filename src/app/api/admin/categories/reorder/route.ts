import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { reorderCategories } from '@/services/category.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return errorResponse('orderedIds must be a non-empty array', 400);
    }

    // validate all entries are non-empty strings
    const allStrings = orderedIds.every(
      (id) => typeof id === 'string' && id.trim().length > 0
    );
    if (!allStrings) {
      return errorResponse('All orderedIds must be valid strings', 400);
    }

    await reorderCategories(orderedIds);

    return successResponse({ message: 'Category order updated successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reorder categories';
    return errorResponse(message, 500);
  }
}