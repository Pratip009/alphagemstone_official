import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getBlogBySlug, incrementViews } from '@/services/blog.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;

    // Increment views (fire-and-forget)
    incrementViews(slug).catch(() => {});

    const blog = await getBlogBySlug(slug);
    if (!blog) return errorResponse('Blog not found', 404);

    return successResponse(blog);
  } catch (err) {
    console.error('[GET /api/blogs/[slug]]', err);
    return errorResponse('Failed to fetch blog', 500);
  }
}