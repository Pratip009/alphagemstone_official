import { notFound } from 'next/navigation';
import BlogDetailClient, { type Blog } from './BlogDetailClient';
import { getPublishedBlog } from './getPublishedBlog';

// Articles are rendered on the server and cached (ISR) for 5 minutes; view
// counts and like state are still updated client-side via /api/blogs/[slug].
export const revalidate = 300;

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublishedBlog(slug);

  // DB unavailable → fall back to the client-side fetch (old behaviour).
  if (result.status === 'error') return <BlogDetailClient />;
  if (result.status === 'missing') notFound();

  return <BlogDetailClient initialBlog={result.blog as Blog} />;
}
