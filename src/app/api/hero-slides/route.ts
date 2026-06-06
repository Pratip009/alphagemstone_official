import { connectDB } from '@/lib/db';
import HeroSlide from '@/models/HeroSlide';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    await connectDB();
    const slides = await HeroSlide.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return successResponse(slides);
  } catch (err) {
    console.error('[GET /api/hero-slides]', err);
    return errorResponse('Failed to fetch hero slides', 500);
  }
}