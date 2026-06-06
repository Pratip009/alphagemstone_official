import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { updateBlog, deleteBlog } from '@/services/blog.service';
import { withAdmin, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import Blog from '@/models/Blog';
import { z } from 'zod';

const updateSchema = z.object({
  title:            z.string().min(1).max(200).optional(),
  slug:             z.string().optional(),
  shortDescription: z.string().min(1).max(500).optional(),
  content:          z.string().min(1).optional(),
  featuredImage:    z.string().optional(),
  category:         z.string().min(1).optional(),
  tags:             z.array(z.string()).optional(),
  seoTitle:         z.string().optional(),
  seoDescription:   z.string().optional(),
  status:           z.enum(['draft', 'published']).optional(),
});

type Params = { params: Promise<{ id: string }> };

export const GET = withAdmin(async (_req: NextRequest, { params }: Params) => {
  try {
    await connectDB();
    const { id } = await params;
    const blog = await Blog.findById(id).lean();
    if (!blog) return errorResponse('Blog not found', 404);
    return successResponse(blog);
  } catch (err) {
    return errorResponse('Failed to fetch blog', 500);
  }
});

export const PUT = withAdmin(async (req: NextRequest, { params }: Params) => {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const blog = await updateBlog(id, parsed.data as Parameters<typeof updateBlog>[1]);
    return successResponse(blog);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update blog';
    const status = msg === 'Blog not found' ? 404 : 500;
    return errorResponse(msg, status);
  }
});

export const DELETE = withAdmin(async (_req: NextRequest, { params }: Params) => {
  try {
    await connectDB();
    const { id } = await params;
    await deleteBlog(id);
    return successResponse({ message: 'Blog deleted' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete blog';
    const status = msg === 'Blog not found' ? 404 : 500;
    return errorResponse(msg, status);
  }
});