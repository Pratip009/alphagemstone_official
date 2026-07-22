import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  listCategories,
  listSubcategories,
  listCategoriesForProductKind,
} from '@/services/category.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const withSubs = req.nextUrl.searchParams.get('withSubcategories') === 'true';
    const productKind = req.nextUrl.searchParams.get('productKind');

    // Scoped lookup: only categories/subcategories that actually contain a
    // product of this kind. Used by the storefront filter bar so the
    // Gemstones tab doesn't show Diamond or Watch categories, etc.
    if (withSubs && productKind) {
      const scoped = await listCategoriesForProductKind(productKind);
      return successResponse(scoped);
    }

    const categories = await listCategories();

    if (withSubs) {
      const subcategories = await listSubcategories();
      const enriched = categories.map((cat) => {
        const catId = (cat as Record<string, unknown>)._id?.toString();
        return {
          ...cat,
          subcategories: subcategories.filter(
            // .populate() replaced category ID with { _id, name, slug } object
            // so we must use ._id to compare, not .toString() directly
            (s) => (s.category as any)?._id?.toString() === catId
          ),
        };
      });
      return successResponse(enriched);
    }

    return successResponse(categories);
  } catch {
    return errorResponse('Failed to fetch categories', 500);
  }
}