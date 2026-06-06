import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import Category from '@/models/Category';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAdmin(async (req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();
    const { id } = await ctx.params;
    const { name, description } = await req.json();
    const category = await Category.findByIdAndUpdate(
      id,
      { ...(name && { name }), ...(description !== undefined && { description }) },
      { new: true, runValidators: true }
    );
    if (!category) return errorResponse('Category not found', 404);
    return successResponse(category);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update', 400);
  }
});

export const DELETE = withAdmin(async (_req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();
    const { id } = await ctx.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) return errorResponse('Category not found', 404);
    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to delete', 400);
  }
});