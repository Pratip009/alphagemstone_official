import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import HeroSlide from '@/models/HeroSlide';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/admin/hero-slides — return ALL slides (active + inactive) for admin
export const GET = withAdmin(async () => {
  try {
    await connectDB();
    const slides = await HeroSlide.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return successResponse(slides);
  } catch (err) {
    console.error('[GET /api/admin/hero-slides]', err);
    return errorResponse('Failed to fetch hero slides', 500);
  }
});

// POST /api/admin/hero-slides — create a new slide
export const POST = withAdmin(async (req: NextRequest) => {
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

    if (!title?.trim()) return errorResponse('Title is required', 400);
    if (!desktopImage?.trim()) return errorResponse('Desktop image is required', 400);

    // Sanitise buttonLink — must be relative or absolute URL, not javascript:
    if (buttonLink) {
      const trimmed = buttonLink.trim().toLowerCase();
      if (trimmed.startsWith('javascript:')) {
        return errorResponse('Invalid button link', 400);
      }
    }

    const slide = await HeroSlide.create({
      title: title.trim(),
      subtitle: subtitle?.trim(),
      description: description?.trim(),
      desktopImage: desktopImage.trim(),
      mobileImage: mobileImage?.trim() || undefined,
      accent: accent?.trim() || '#b8c9d4',
      accentGlow: accentGlow?.trim() || '#5a8fa8',
      buttonText: buttonText?.trim(),
      buttonLink: buttonLink?.trim(),
      openInNewTab: openInNewTab === true,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      isActive: isActive !== false,
    });

    return successResponse(slide, 201);
  } catch (err) {
    console.error('[POST /api/admin/hero-slides]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to create hero slide',
      400
    );
  }
});