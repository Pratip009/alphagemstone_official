import { connectDB } from '@/lib/db';
import { getBlogCategories } from '@/services/blog.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    await connectDB();
    const categories = await getBlogCategories();
    return successResponse(categories);
  } catch (err) {
    console.error('[GET /api/blogs/categories]', err);
    return errorResponse('Failed to fetch categories', 500);
  }
}