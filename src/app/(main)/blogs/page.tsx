import BlogsClient, { type BlogCard, type Pagination } from './BlogsClient';

// Re-render the server-side first page at most every 5 minutes (ISR) rather
// than hitting MongoDB on every visit.
export const revalidate = 300;

const PAGE_SIZE = 9;

async function getInitialData(): Promise<{
  blogs: BlogCard[] | null;
  pagination: Pagination | null;
  categories: string[] | null;
}> {
  try {
    const { connectDB } = await import('@/lib/db');
    const { listPublishedBlogs, getBlogCategories } = await import('@/services/blog.service');
    await connectDB();

    const [{ blogs, total }, categories] = await Promise.all([
      listPublishedBlogs({ page: 1, limit: PAGE_SIZE, sort: 'latest' }),
      getBlogCategories(),
    ]);

    // Send only what the cards render. The full likes/comments arrays are
    // replaced by counts so the HTML/RSC payload stays small.
    const lean: BlogCard[] = (blogs as any[]).map((b) => ({
      _id: String(b._id),
      title: b.title ?? '',
      slug: b.slug,
      shortDescription: b.shortDescription ?? '',
      featuredImage: b.featuredImage ?? '',
      category: b.category ?? '',
      publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString() : '',
      likeCount: Array.isArray(b.likes) ? b.likes.length : 0,
      commentCount: Array.isArray(b.comments) ? b.comments.length : 0,
    }));

    return {
      blogs: lean,
      pagination: {
        total,
        page: 1,
        limit: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
      categories: (categories as unknown[]).filter(Boolean).map(String),
    };
  } catch (err) {
    // Fall back to the old client-side fetch rather than failing the page.
    console.error('[blogs page] initial fetch failed:', err);
    return { blogs: null, pagination: null, categories: null };
  }
}

export default async function BlogsPage() {
  const { blogs, pagination, categories } = await getInitialData();
  return (
    <BlogsClient
      initialBlogs={blogs}
      initialPagination={pagination}
      initialCategories={categories}
    />
  );
}
