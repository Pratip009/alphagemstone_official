import { cache } from 'react';

type Result =
  | { status: 'ok'; blog: unknown }
  | { status: 'missing' }
  | { status: 'error' };

// React cache() dedupes the lookup between generateMetadata (layout.tsx) and
// the page within a single request: one DB query instead of two.
export const getPublishedBlog = cache(async (slug: string): Promise<Result> => {
  try {
    const { connectDB } = await import('@/lib/db');
    const { getBlogBySlug } = await import('@/services/blog.service');
    await connectDB();
    const blog = await getBlogBySlug(slug);
    if (!blog) return { status: 'missing' };
    // Strip ObjectIds / Dates into plain JSON so it can cross to the client.
    return { status: 'ok', blog: JSON.parse(JSON.stringify(blog)) };
  } catch (err) {
    console.error('[blogs/[slug]] fetch failed:', err);
    return { status: 'error' };
  }
});
