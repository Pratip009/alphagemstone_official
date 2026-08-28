// app/api/admin/subsubcategories/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer, destroyImage } from '@/lib/r2';
import SubSubcategory from '@/models/SubSubcategory';

type Ctx = { params: Promise<{ id: string }> };

// ── DELETE /api/admin/subsubcategories/:id ───────────────────────────────────
// Deletes the DB document AND removes the image from Cloudinary/R2.
// NOTE: this does not touch any Product that references this
// sub-subcategory — those products simply stop being scoped by it (they
// keep their real category/subcategory) and fall back to the plain
// subcategory listing.
export const DELETE = withAdmin(async (_req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const { id } = await ctx.params;
    const doc = await SubSubcategory.findById(id);
    if (!doc) return errorResponse('Sub-subcategory not found', 404);

    if (doc.imagePublicId) await destroyImage(doc.imagePublicId);

    await doc.deleteOne();
    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});

// ── PATCH /api/admin/subsubcategories/:id ─────────────────────────────────────
// Updates name/description/image/sortOrder/isActive.
// Accepts multipart/form-data (with image) or JSON (without).
export const PATCH = withAdmin(async (req: NextRequest, ctx: Ctx) => {
  try {
    await connectDB();

    const { id } = await ctx.params;
    const doc = await SubSubcategory.findById(id);
    if (!doc) return errorResponse('Sub-subcategory not found', 404);

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form        = await req.formData();
      const name        = form.get('name')        as string | null;
      const description = form.get('description') as string | null;
      const sortOrder   = form.get('sortOrder')   as string | null;
      const isActive    = form.get('isActive')    as string | null;
      const file         = form.get('image')       as File   | null;

      if (name) {
        doc.name = name;
        doc.slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (description !== null) doc.description = description ?? undefined;
      if (sortOrder !== null && sortOrder !== '') doc.sortOrder = Number(sortOrder);
      if (isActive !== null) doc.isActive = isActive === 'true';

      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024)
          return errorResponse('Image must be ≤ 5 MB', 400);

        if (doc.imagePublicId) await destroyImage(doc.imagePublicId);

        const buffer      = Buffer.from(await file.arrayBuffer());
        const uploaded    = await uploadBuffer(buffer, file.name, 'subsubcategories');
        doc.imageUrl      = uploaded.secure_url;
        doc.imagePublicId = uploaded.public_id;
      }
    } else {
      const body = await req.json();
      if (body.name) {
        doc.name = body.name;
        doc.slug = body.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (body.description !== undefined) doc.description = body.description;
      if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder);
      if (body.isActive !== undefined) doc.isActive = !!body.isActive;
    }

    await doc.save();
    return successResponse(doc);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});
