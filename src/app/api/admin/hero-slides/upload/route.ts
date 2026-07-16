import { NextRequest } from 'next/server';
import { uploadBuffer } from '@/lib/cloudinary';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertValidImageBuffer } from '@/lib/file-signature';

const MAX_SIZE_MB = 10;

// POST /api/admin/hero-slides/upload
// FormData: file (single image), variant: "desktop" | "mobile"
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return errorResponse('No file provided', 400);

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return errorResponse(`File exceeds the ${MAX_SIZE_MB} MB limit`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify the file's actual content matches a real image format.
    // `file.type` is client-supplied and trivially spoofable (a caller
    // can label an .html or .svg-with-script file as "image/png"), so it
    // is never trusted for this decision.
    try {
      assertValidImageBuffer(buffer);
    } catch {
      return errorResponse(
        'Invalid file: content is not a supported image format (JPEG, PNG, WebP, GIF, BMP)',
        400
      );
    }

    const { secure_url, public_id } = await uploadBuffer(buffer, file.name, 'hero-slides');

    return successResponse({ url: secure_url, publicId: public_id });
  } catch (err) {
    console.error('[POST /api/admin/hero-slides/upload]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Upload failed',
      500
    );
  }
});