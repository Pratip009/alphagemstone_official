// app/api/admin/subcategories/[id]/image/route.ts
//
// POST   /api/admin/subcategories/:id/image  → upload / replace image
// DELETE /api/admin/subcategories/:id/image  → remove image entirely

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer, destroyImage } from '@/lib/cloudinary';
import Subcategory from '@/models/Subcategory';

type Ctx = { params: Promise<{ id: string }> };

// ── POST ─────────────────────────────────────────────────────────────────────
export const POST = withAdmin(async (req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const { id } = await ctx.params;
    const sub = await Subcategory.findById(id);
    if (!sub) return errorResponse('Subcategory not found', 404);

    const form = await req.formData();
    const file = form.get('image') as File | null;

    if (!file || file.size === 0)
      return errorResponse('No image provided', 400);
    if (file.size > 5 * 1024 * 1024)
      return errorResponse('Image must be ≤ 5 MB', 400);

    // Replace old image if one exists
    if (sub.imagePublicId) await destroyImage(sub.imagePublicId);

    const buffer      = Buffer.from(await file.arrayBuffer());
    const uploaded    = await uploadBuffer(buffer, file.name, 'subcategories');
    sub.imageUrl      = uploaded.secure_url;
    sub.imagePublicId = uploaded.public_id;

    await sub.save();
    return successResponse(sub);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
export const DELETE = withAdmin(async (_req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const { id } = await ctx.params;
    const sub = await Subcategory.findById(id);
    if (!sub) return errorResponse('Subcategory not found', 404);

    if (sub.imagePublicId) {
      await destroyImage(sub.imagePublicId);
      sub.imagePublicId = undefined;
      sub.imageUrl      = undefined;
      await sub.save();
    }

    return successResponse({ removed: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});