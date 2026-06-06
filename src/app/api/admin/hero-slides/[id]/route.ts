import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import HeroSlide from '@/models/HeroSlide';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

type Context = { params: { id: string } };

// GET /api/admin/hero-slides/:id
export const GET = withAdmin(async (_req: NextRequest, ctx: Context) => {
  try {
    await connectDB();
    const slide = await HeroSlide.findById(ctx.params.id).lean();
    if (!slide) return errorResponse('Slide not found', 404);
    return successResponse(slide);
  } catch (err) {
    console.error('[GET /api/admin/hero-slides/:id]', err);
    return errorResponse('Failed to fetch hero slide', 500);
  }
});

// PUT /api/admin/hero-slides/:id
export const PUT = withAdmin(async (req: NextRequest, ctx: Context) => {
  try {
    await connectDB();
    const body = await req.json();

    const {
      title, subtitle, description,
      desktopImage, mobileImage,
      accent, accentGlow,
      buttonText, buttonLink, openInNewTab,
      displayOrder, isActive,
    } = body;

    if (title !== undefined && !title?.trim()) {
      return errorResponse('Title cannot be empty', 400);
    }
    if (desktopImage !== undefined && !desktopImage?.trim()) {
      return errorResponse('Desktop image cannot be empty', 400);
    }
    if (buttonLink) {
      const trimmed = buttonLink.trim().toLowerCase();
      if (trimmed.startsWith('javascript:')) {
        return errorResponse('Invalid button link', 400);
      }
    }

    const update: Record<string, unknown> = {};
    if (title !== undefined)        update.title        = title.trim();
    if (subtitle !== undefined)     update.subtitle     = subtitle?.trim();
    if (description !== undefined)  update.description  = description?.trim();
    if (desktopImage !== undefined) update.desktopImage = desktopImage.trim();
    if (mobileImage !== undefined)  update.mobileImage  = mobileImage?.trim() || undefined;
    if (accent !== undefined)       update.accent       = accent?.trim() || '#b8c9d4';
    if (accentGlow !== undefined)   update.accentGlow   = accentGlow?.trim() || '#5a8fa8';
    if (buttonText !== undefined)   update.buttonText   = buttonText?.trim();
    if (buttonLink !== undefined)   update.buttonLink   = buttonLink?.trim();
    if (openInNewTab !== undefined) update.openInNewTab = openInNewTab === true;
    if (displayOrder !== undefined) update.displayOrder = Number(displayOrder);
    if (isActive !== undefined)     update.isActive     = isActive === true;

    const slide = await HeroSlide.findByIdAndUpdate(
      ctx.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!slide) return errorResponse('Slide not found', 404);
    return successResponse(slide);
  } catch (err) {
    console.error('[PUT /api/admin/hero-slides/:id]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to update hero slide',
      400
    );
  }
});

// DELETE /api/admin/hero-slides/:id
export const DELETE = withAdmin(async (_req: NextRequest, ctx: Context) => {
  try {
    await connectDB();
    const slide = await HeroSlide.findByIdAndDelete(ctx.params.id);
    if (!slide) return errorResponse('Slide not found', 404);
    return successResponse({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/admin/hero-slides/:id]', err);
    return errorResponse('Failed to delete hero slide', 500);
  }
});