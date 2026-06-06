import { Metadata } from 'next';
import { connectDB } from '@/lib/db';
import { getBlogBySlug } from '@/services/blog.service';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  try {
    await connectDB();
    const { slug } = await params;
    const blog = await getBlogBySlug(slug);
    if (!blog) return { title: 'Article Not Found' };

    const title       = blog.seoTitle || blog.title;
    const description = blog.seoDescription || blog.shortDescription;
    const image       = blog.featuredImage || '';
    const url         = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/blogs/${slug}`;

    return {
      title:       `${title} | Alpha Imports Blog`,
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
  } catch {
    return { title: 'Alpha Imports Blog' };
  }
}

export { default } from './page';