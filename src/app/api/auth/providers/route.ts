import { NextResponse } from 'next/server';
import { isGoogleAuthConfigured } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

/** GET /api/auth/providers — which sign-in methods this deployment offers. */
export async function GET() {
  return NextResponse.json(
    { success: true, data: { password: true, google: isGoogleAuthConfigured() } },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
