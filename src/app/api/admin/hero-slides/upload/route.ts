import { NextRequest } from 'next/server';
import { uploadBuffer } from '@/lib/cloudinary';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 10;

// POST /api/admin/hero-slides/upload
// FormData: file (single image), variant: "desktop" | "mobile"
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return errorResponse('No file provided', 400);

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(
        `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF`,
        400
      );
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return errorResponse(`File exceeds the ${MAX_SIZE_MB} MB limit`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
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