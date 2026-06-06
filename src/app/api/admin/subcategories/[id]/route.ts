// app/api/admin/subcategories/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer, destroyImage } from '@/lib/cloudinary';
import Subcategory from '@/models/Subcategory';

type Ctx = { params: Record<string, string> };

// ── DELETE /api/admin/subcategories/:id ──────────────────────────────────────
// Deletes the DB document AND removes the image from Cloudinary.
export const DELETE = withAdmin(async (_req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const sub = await Subcategory.findById(ctx.params.id);
    if (!sub) return errorResponse('Subcategory not found', 404);

    // Remove image from Cloudinary first (non-blocking on failure)
    if (sub.imagePublicId) await destroyImage(sub.imagePublicId);

    await sub.deleteOne();
    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});

// ── PATCH /api/admin/subcategories/:id ───────────────────────────────────────
// Updates name and/or description and/or image.
// Accepts multipart/form-data (with image) or JSON (without).
export const PATCH = withAdmin(async (req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const sub = await Subcategory.findById(ctx.params.id);
    if (!sub) return errorResponse('Subcategory not found', 404);

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form        = await req.formData();
      const name        = form.get('name')        as string | null;
      const description = form.get('description') as string | null;
      const file        = form.get('image')       as File   | null;

      if (name) {
        sub.name = name;
        sub.slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (description !== null) sub.description = description ?? undefined;

      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024)
          return errorResponse('Image must be ≤ 5 MB', 400);

        // Delete old image before uploading the new one
        if (sub.imagePublicId) await destroyImage(sub.imagePublicId);

        const buffer      = Buffer.from(await file.arrayBuffer());
        const uploaded    = await uploadBuffer(buffer, file.name, 'subcategories');
        sub.imageUrl      = uploaded.secure_url;
        sub.imagePublicId = uploaded.public_id;
      }
    } else {
      const body = await req.json();
      if (body.name) {
        sub.name = body.name;
        sub.slug = body.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (body.description !== undefined) sub.description = body.description;
    }

    await sub.save();
    return successResponse(sub);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});