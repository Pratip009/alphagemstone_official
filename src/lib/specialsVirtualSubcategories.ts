// ─── Specials virtual subcategories ────────────────────────────────────────
// The legacy site's "Specials" nav tab included a few entries that were
// never real product subcategories — they were a live filter applied
// across every category (any diamond/gemstone/jewelry/watch product priced
// at $9.99, or flagged "make an offer", etc). There's no Subcategory DB row
// or product.subcategory ref backing them, so they can't be resolved the
// normal way — they're handled as a named filter criterion instead.
//
// Single source of truth for both:
//   - the UI (nav dropdown / /category/specials grid — see
//     getNavCategories.ts and category/[slug]/page.tsx)
//   - the query layer (productFilter.service.ts), which applies `match`
//     directly onto the Mongo filter instead of resolving a subcategory id.
//
// Only include entries here that have real backing data. Old-site nav items
// with NO stored attribute to filter on (New Arrivals, Today/Hourly
// Specials, Buy One Get Something Free, Good For eBay) are deliberately
// left out — there's nothing in the product data to select them by, and a
// subcategory page with zero real logic behind it is worse than not having
// the page. Auctions/Videos/Free Jewelry Games/Free Birthstone/the
// gemstone calculator aren't product listings at all and don't belong in
// this list regardless of data — they need their own standalone pages.
import { FilterQuery } from 'mongoose';
import { IProduct } from '@/models/Product';

export interface SpecialsVirtualSubcategory {
  slug: string;
  name: string;
  /** Short blurb shown on the Specials collections grid card. */
  description: string;
  match: FilterQuery<IProduct>;
}

export const SPECIALS_VIRTUAL_SUBCATEGORIES: SpecialsVirtualSubcategory[] = [
  {
    slug: 'make-an-offer',
    name: 'Make An Offer',
    description: 'Submit your own price on these pieces.',
    match: { makeAnOffer: true },
  },
  {
    slug: '9-99-specials',
    name: '$9.99 Specials',
    description: 'Every piece in this collection is $9.99.',
    match: { price: { $gte: 9.98, $lte: 9.99 } },
  },
  {
    slug: '24-99-specials',
    name: '$24.99 Specials',
    description: 'Every piece in this collection is $24.99.',
    match: { price: { $gte: 24.98, $lte: 24.99 } },
  },
  {
    slug: '99-00-specials',
    name: '$99.00 Specials',
    description: 'Every piece in this collection is $99.00.',
    match: { price: { $gte: 98.99, $lte: 99.0 } },
  },
];

export const SPECIALS_VIRTUAL_SUBCATEGORY_MAP: Record<string, SpecialsVirtualSubcategory> =
  Object.fromEntries(SPECIALS_VIRTUAL_SUBCATEGORIES.map((s) => [s.slug, s]));