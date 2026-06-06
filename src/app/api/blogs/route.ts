import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { listPublishedBlogs } from '@/services/blog.service';
import { paginatedResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const page     = parseInt(searchParams.get('page')     ?? '1', 10);
    const limit    = parseInt(searchParams.get('limit')    ?? '9', 10);
    const search   = searchParams.get('search')   ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const sort     = (searchParams.get('sort') as 'latest' | 'popular') ?? 'latest';

    const { blogs, total } = await listPublishedBlogs({ page, limit, search, category, sort });

    return paginatedResponse(blogs, total, page, limit);
  } catch (err) {
    console.error('[GET /api/blogs]', err);
    return errorResponse('Failed to fetch blogs', 500);
  }
}