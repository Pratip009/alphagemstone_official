import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { adminListBlogs, createBlog } from '@/services/blog.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { paginatedResponse, successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import User from '@/models/User';

const createBlogSchema = z.object({
  title:            z.string().min(1).max(200),
  slug:             z.string().optional(),
  shortDescription: z.string().min(1).max(500),
  content:          z.string().min(1),
  featuredImage:    z.string().optional().default(''),
  category:         z.string().min(1),
  tags:             z.array(z.string()).default([]),
  seoTitle:         z.string().optional(),
  seoDescription:   z.string().optional(),
  status:           z.enum(['draft', 'published']),
});

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const page   = parseInt(searchParams.get('page')  ?? '1', 10);
    const limit  = parseInt(searchParams.get('limit') ?? '10', 10);
    const search = searchParams.get('search') ?? undefined;
    const status = (searchParams.get('status') as 'draft' | 'published' | 'all') ?? 'all';

    const { blogs, total } = await adminListBlogs({ page, limit, search, status });
    return paginatedResponse(blogs, total, page, limit);
  } catch (err) {
    console.error('[GET /api/admin/blogs]', err);
    return errorResponse('Failed to fetch blogs', 500);
  }
});

export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = createBlogSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    // Get admin name
    const user = await User.findById(req.user.userId).select('name').lean();
    const authorName = (user as { name?: string } | null)?.name ?? 'Admin';

    const blog = await createBlog({
      ...parsed.data,
      authorId:   req.user.userId,
      authorName,
    });

    return successResponse(blog, 201);
  } catch (err) {
    console.error('[POST /api/admin/blogs]', err);
    const msg = err instanceof Error ? err.message : 'Failed to create blog';
    return errorResponse(msg, 500);
  }
});