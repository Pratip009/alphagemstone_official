// lib/getNavCategories.ts
// Queries MongoDB directly — no internal HTTP round-trip.
// Called only from Server Components / RSC layouts, never in the browser.

import { unstable_cache } from 'next/cache';

export interface NavSubcategory {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive?: boolean;
  // Whether this subcategory has its own SubSubcategory children (e.g.
  // Tanzanite > Oval Tanzanite / Trillion Tanzanite / …). Drives whether
  // clicking it in the navbar opens the /category/[slug]/[subSlug] landing
  // page or goes straight to the filtered product listing.
  hasChildren?: boolean;
}

export interface NavCategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
  subcategories: NavSubcategory[];
}


// Nav categories change rarely (only when an admin edits categories), yet
// this runs on every page render via the layouts / FooterPageLayout. Caching
// it in the Next data cache removes a MongoDB round trip from the critical
// path of every request (TTFB). Admin category routes can call
// revalidateTag('nav-categories') to refresh immediately; otherwise it
// refreshes every 10 minutes.
const getCachedNavCategories = unstable_cache(
  fetchNavCategories,
  ['nav-categories'],
  { revalidate: 600, tags: ['nav-categories'] },
);

export async function getNavCategories(): Promise<NavCategory[]> {
  try {
    return await getCachedNavCategories();
  } catch (err) {
    // Errors are thrown out of the cached function (not swallowed inside it)
    // so a transient DB failure never gets an empty list cached for 10 min.
    console.error('[getNavCategories]', err);
    return [];
  }
}

async function fetchNavCategories(): Promise<NavCategory[]> {
  {
    const { connectDB } = await import('@/lib/db');
    const { listCategories, listSubcategoriesWithChildFlagAll } = await import('@/services/category.service');
    const { SPECIALS_VIRTUAL_SUBCATEGORIES } = await import('@/lib/specialsVirtualSubcategories');

    await connectDB();

    const [categories, subcategories] = await Promise.all([
      listCategories(),
      listSubcategoriesWithChildFlagAll(),
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
            hasChildren: s.hasChildren === true,
          }));

        // "Specials" also carries a few virtual subcategories (Make An
        // Offer, $9.99/$24.99/$99.00 Specials) that aren't real Subcategory
        // documents — see specialsVirtualSubcategories.ts for why. Append
        // them here so they show in the nav alongside the real ones.
        if (cat.slug === 'specials') {
          for (const v of SPECIALS_VIRTUAL_SUBCATEGORIES) {
            subs.push({
              _id: `virtual-${v.slug}`,
              name: v.name,
              slug: v.slug,
              imageUrl: undefined,
              isActive: true,
              hasChildren: false, 
            });
          }
        }

        return {
          _id: catId,
          name: cat.name,
          slug: cat.slug,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
          subcategories: subs,
        };
      });
  }
}