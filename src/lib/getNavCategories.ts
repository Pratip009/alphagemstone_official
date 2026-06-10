// lib/getNavCategories.ts
// Queries MongoDB directly — no internal HTTP round-trip.
// Called only from Server Components / RSC layouts, never in the browser.

export interface NavSubcategory {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface NavCategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
  subcategories: NavSubcategory[];
}

export async function getNavCategories(): Promise<NavCategory[]> {
  try {
    const { connectDB } = await import('@/lib/db');
    const { listCategories, listSubcategories } = await import('@/services/category.service');

    await connectDB();

    const [categories, subcategories] = await Promise.all([
      listCategories(),
      listSubcategories(),
    ]);

    return categories
      .filter((c: any) => c.isActive !== false)
      .map((cat: any) => {
        const catId = cat._id?.toString();
        const subs = subcategories
          .filter((s: any) => {
            const parentId =
              (s.category as any)?._id?.toString() ?? s.category?.toString();
            return parentId === catId && s.isActive !== false;
          })
          .map((s: any) => ({
            _id: s._id?.toString(),
            name: s.name,
            slug: s.slug,
            imageUrl: s.imageUrl ?? undefined,
            isActive: s.isActive,
          }));

        return {
          _id: catId,
          name: cat.name,
          slug: cat.slug,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
          subcategories: subs,
        };
      });
  } catch (err) {
    console.error('[getNavCategories]', err);
    return [];
  }
}