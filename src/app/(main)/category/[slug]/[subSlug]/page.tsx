import { connectDB } from "@/lib/db";
import { listSubSubcategories } from "@/services/category.service";
import Category from "@/models/Category";
import Subcategory from "@/models/Subcategory";
import { notFound, redirect } from "next/navigation";
import CategoryClientPage from "../CategoryClientPage";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

interface PageProps {
  params: Promise<{ slug: string; subSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await connectDB();
  const { slug, subSlug } = await params;
  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) return { title: "Not Found", robots: { index: false, follow: true } };
  const subcategory = await Subcategory.findOne({
    slug: subSlug,
    category: (category as any)._id,
    isActive: true,
  }).lean();
  if (!subcategory) return { title: "Not Found", robots: { index: false, follow: true } };

  const catName = (category as any).name as string;
  const subName = (subcategory as any).name as string;
  const title = `${subName} — ${catName} | Alpha Gemstone`;
  const description =
    (subcategory as any).description ??
    `Browse ${subName} ${catName} at Alpha Gemstone — quality stones, expertly curated.`;
  const canonical = `${SITE_URL}/category/${slug}/${subSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "Alpha Gemstone",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SubSubcategoryPage({ params }: PageProps) {
  await connectDB();
  const { slug, subSlug } = await params;

  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) notFound();

  const subcategory = await Subcategory.findOne({
    slug: subSlug,
    category: (category as any)._id,
    isActive: true,
  }).lean();
  if (!subcategory) notFound();

  const subSubcategoryId = (subcategory as any)._id?.toString();
  const items = await listSubSubcategories(subSubcategoryId);

  // A subcategory with no children (the vast majority) has no business
  // being on this intermediate page at all — send the shopper straight to
  // the product listing instead of showing an empty grid. (The subcategory
  // grid itself never links here unless hasChildren was true, but this
  // covers anyone hitting the URL directly.)
  if (items.length === 0) {
    redirect(`/products?category=${slug}&subcategory=${subSlug}`);
  }

  const serializedSubcategory = {
    _id: subSubcategoryId,
    name: (subcategory as any).name,
    slug: (subcategory as any).slug,
    description: (subcategory as any).description ?? null,
  };

  const serializedItems = items.map((s) => ({
    _id: String((s as any)._id),
    name: s.name,
    slug: s.slug,
    imageUrl: (s as any).imageUrl ?? null,
    description: (s as any).description ?? null,
    hasChildren: false,
    category: {
      _id: String((category as any)._id),
      name: (category as any).name,
      slug: (category as any).slug,
    },
  }));

  const canonical = `${SITE_URL}/category/${slug}/${subSlug}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: (category as any).name,
        item: `${SITE_URL}/category/${slug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: serializedSubcategory.name,
        item: canonical,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CategoryClientPage
        category={serializedSubcategory}
        subcategories={serializedItems}
        mode="subsubcategory"
        parentSubcategorySlug={subSlug}
      />
    </>
  );
}
