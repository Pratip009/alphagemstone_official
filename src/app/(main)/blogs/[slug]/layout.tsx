import { Metadata } from 'next';
import { getPublishedBlog } from './getPublishedBlog';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedBlog(slug);
  if (result.status === 'missing') return { title: 'Article Not Found' };
  if (result.status !== 'ok') return { title: 'Alpha Gemstone Blog' };

  const blog = result.blog as any;
  const title       = blog.seoTitle || blog.title;
  const description = blog.seoDescription || blog.shortDescription;
  const image       = blog.featuredImage || '';
  const url         = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/blogs/${slug}`;

  return {
    title:       `${title} | Alpha Gemstone Blog`,
    description,
    alternates:  { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: blog.publishedAt?.toString(),
      authors: [blog.authorName],
      tags: blog.tags,
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : [],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      image ? [image] : [],
    },
  };
}

// Previously this file did `export { default } from './page'`, which made the
// client page component double as the layout. A plain pass-through layout
// lets page.tsx be a real server component.
export default function BlogSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
