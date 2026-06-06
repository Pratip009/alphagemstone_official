// app/api/admin/subcategories/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createSubcategory, listSubcategories } from '@/services/category.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer } from '@/lib/cloudinary';

// ── POST /api/admin/subcategories ────────────────────────────────────────────
// Accepts EITHER:
//   multipart/form-data  →  fields: name, categoryId, description?, image (File)
//   application/json     →  { name, categoryId, description? }   (no image — old clients)
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();

    let name: string        = '';
    let categoryId: string  = '';
    let description: string | undefined;
    let imageUrl: string    | undefined;
    let imagePublicId: string | undefined;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      // ── multipart path (supports image) ───────────────────────────────────
      const form = await req.formData();
      name        = (form.get('name')        as string | null) ?? '';
      categoryId  = (form.get('categoryId')  as string | null) ?? '';
      description = (form.get('description') as string | null) ?? undefined;

      const file = form.get('image') as File | null;
      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024)
          return errorResponse('Image must be ≤ 5 MB', 400);

        const buffer   = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadBuffer(buffer, file.name, 'subcategories');
        imageUrl      = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
      }
    } else {
      // ── JSON path (no image — backwards compatible) ───────────────────────
      const body = await req.json();
      name        = body.name       ?? '';
      categoryId  = body.categoryId ?? '';
      description = body.description;
    }

    if (!name || !categoryId)
      return errorResponse('name and categoryId are required', 400);

    // createSubcategory in your service handles slug generation & DB insert.
    // Pass the extra image fields — update the service signature to accept them
    // (see category.service.ts changes below).
    const sub = await createSubcategory(name, categoryId, description, imageUrl, imagePublicId);
    return successResponse(sub, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});

// ── GET /api/admin/subcategories ─────────────────────────────────────────────
// Unchanged from your original.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const categoryId = req.nextUrl.searchParams.get('category') || undefined;
    const subs = await listSubcategories(categoryId);
    return successResponse(subs);
  } catch {
    return errorResponse('Failed to fetch subcategories', 500);
  }
}