import { connectDB } from "@/lib/db";
import { listSubcategories } from "@/services/category.service";
import Category from "@/models/Category";
import { notFound } from "next/navigation";
import CategoryClientPage from "./CategoryClientPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  await connectDB();
  const { slug } = await params;
  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) return { title: "Category Not Found" };
  return {
    title: `${(category as any).name} — Collections`,
    description: (category as any).description ?? `Browse our ${(category as any).name} collection`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  await connectDB();
  const { slug } = await params;

  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) notFound();

  const allSubs = await listSubcategories();
  const catId = (category as any)._id?.toString();

  const subcategories = allSubs
    .filter((s) => (s.category as any)?._id?.toString() === catId && s.isActive)
    .map((s) => ({
      _id: String((s as any)._id),
      name: s.name,
      slug: s.slug,
      imageUrl: (s as any).imageUrl ?? null,
      description: (s as any).description ?? null,
      category: {
        _id: catId,
        name: (category as any).name,
        slug: (category as any).slug,
      },
    }));

  const serializedCategory = {
    _id: catId,
    name: (category as any).name,
    slug: (category as any).slug,
    description: (category as any).description ?? null,
  };

  return (
    <CategoryClientPage
      category={serializedCategory}
      subcategories={subcategories}
    />
  );
}