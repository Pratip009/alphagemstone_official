// app/api/admin/subsubcategories/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createSubSubcategory, listSubSubcategories } from '@/services/category.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer } from '@/lib/r2';
import { assertValidImageBuffer } from '@/lib/file-signature';

// ── POST /api/admin/subsubcategories ─────────────────────────────────────────
// Accepts EITHER:
//   multipart/form-data  →  fields: name, subcategoryId, description?, image (File)
//   application/json     →  { name, subcategoryId, description? }  (no image)
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();

    let name: string          = '';
    let subcategoryId: string = '';
    let description: string   | undefined;
    let imageUrl: string      | undefined;
    let imagePublicId: string | undefined;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      name          = (form.get('name')          as string | null) ?? '';
      subcategoryId = (form.get('subcategoryId')  as string | null) ?? '';
      description   = (form.get('description')   as string | null) ?? undefined;

      const file = form.get('image') as File | null;
      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024)
          return errorResponse('Image must be ≤ 5 MB', 400);

        const buffer = Buffer.from(await file.arrayBuffer());

        // Client-supplied MIME type/extension are attacker-controlled and are
        // never trusted for this decision — verify the actual bytes.
        try {
          assertValidImageBuffer(buffer);
        } catch {
          return errorResponse(
            'Invalid file: content is not a supported image format (JPEG, PNG, WebP, GIF, BMP)',
            400
          );
        }

        const uploaded = await uploadBuffer(buffer, file.name, 'subsubcategories');
        imageUrl      = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
      }
    } else {
      const body = await req.json();
      name          = body.name          ?? '';
      subcategoryId = body.subcategoryId ?? '';
      description   = body.description;
    }

    if (!name || !subcategoryId)
      return errorResponse('name and subcategoryId are required', 400);

    const doc = await createSubSubcategory(name, subcategoryId, description, imageUrl, imagePublicId);
    return successResponse(doc, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 400);
  }
});

// ── GET /api/admin/subsubcategories?subcategory=<id> ─────────────────────────
export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const subcategoryId = req.nextUrl.searchParams.get('subcategory') || undefined;
    const items = await listSubSubcategories(subcategoryId);
    return successResponse(items);
  } catch {
    return errorResponse('Failed to fetch sub-subcategories', 500);
  }
});