import Category from '@/models/Category';
import Subcategory from '@/models/Subcategory';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createCategory(name: string, description?: string) {
  const slug = slugify(name);
  const existing = await Category.findOne({ slug }).lean();
  if (existing) throw new Error('Category with this name already exists');

  // assign sortOrder = current max + 1 so new categories go to the end
  const last = await Category.findOne({ isActive: true })
    .sort({ sortOrder: -1 })
    .lean();
  const sortOrder = last ? ((last as any).sortOrder ?? 0) + 1 : 0;

  const category = new Category({ name, slug, description, sortOrder });
  await category.save();
  return category.toObject();
}

export async function listCategories() {
  // sort by sortOrder first, then createdAt as tiebreaker for legacy docs
  return Category.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
}

export async function reorderCategories(orderedIds: string[]) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('orderedIds must be a non-empty array');
  }

  // run all updates in parallel
  await Promise.all(
    orderedIds.map((id, index) =>
      Category.findByIdAndUpdate(id, { sortOrder: index }, { new: true })
    )
  );
}

/**
 * Categories/subcategories that actually contain at least one active
 * product of the given kind ('diamond' | 'gemstone' | 'watch' | 'jewelry').
 *
 * Needed because gemstones (and to a lesser extent diamonds/watches) don't
 * map 1:1 onto a single category — a gemstone product can sit under
 * "Precious Gems", "Semi Precious", "Specials", etc. Filtering by the
 * product's own `productKind` field (rather than by category name/slug) is
 * the only reliable way to answer "which categories belong under this
 * tab", so the storefront filter bar doesn't show Diamond categories while
 * the Gemstones tab is active, and vice versa.
 */
export async function listCategoriesForProductKind(productKind: string) {
  // Lazy import to avoid a circular dependency with Product.ts at module load.
  const { default: Product } = await import('@/models/Product');

  const [categoryIds, subcategoryIds] = await Promise.all([
    Product.distinct('category', { productKind, isActive: true }),
    Product.distinct('subcategory', { productKind, isActive: true }),
  ]);

  const [categories, subcategories] = await Promise.all([
    Category.find({ _id: { $in: categoryIds }, isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean(),
    Subcategory.find({ _id: { $in: subcategoryIds }, isActive: true })
      .populate('category', 'name slug')
      .lean(),
  ]);

  return categories.map((cat) => {
    const catId = (cat as Record<string, unknown>)._id?.toString();
    return {
      ...cat,
      subcategories: subcategories.filter(
        (s) => (s.category as any)?._id?.toString() === catId
      ),
    };
  });
}

export async function createSubcategory(
  name: string,
  categoryId: string,
  description?: string,
  imageUrl?: string,
  imagePublicId?: string
) {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error('Category not found');

  const slug = slugify(name);
  const existing = await Subcategory.findOne({ slug, category: categoryId }).lean();
  if (existing) throw new Error('Subcategory already exists in this category');

  const sub = new Subcategory({ name, slug, category: categoryId, description });
  await sub.save();
  return sub.toObject();
}

export async function listSubcategories(categoryId?: string) {
  const filter: Record<string, unknown> = { isActive: true };
  if (categoryId) filter.category = categoryId;
  return Subcategory.find(filter)
    .populate('category', 'name slug')
    .sort({ name: 1 })
    .lean();
}