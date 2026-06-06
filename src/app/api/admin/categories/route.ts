import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createCategory, listCategories } from '@/services/category.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { name, description } = await req.json();
    if (!name) return errorResponse('Name is required', 400);
    const category = await createCategory(name, description);
    return successResponse(category, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to create category', 400);
  }
});

export async function GET() {
  try {
    await connectDB();
    const categories = await listCategories();
    return successResponse(categories);
  } catch {
    return errorResponse('Failed to fetch categories', 500);
  }
}
