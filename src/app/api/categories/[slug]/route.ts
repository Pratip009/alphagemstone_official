import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { listSubcategories } from '@/services/category.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import Category from '@/models/Category';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;

    const category = await Category.findOne({ slug, isActive: true }).lean();
    if (!category) return errorResponse('Category not found', 404);

    const allSubs = await listSubcategories();
    const catId = (category as any)._id?.toString();

    const subcategories = allSubs.filter(
      (s) => (s.category as any)?._id?.toString() === catId
    );

    return successResponse({ ...category, subcategories });
  } catch {
    return errorResponse('Failed to fetch category', 500);
  }
}