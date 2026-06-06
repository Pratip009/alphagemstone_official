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