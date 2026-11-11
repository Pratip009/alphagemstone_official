import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { unsubscribeEmail } from '@/services/newsletter.service';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';

// Link in the email footer → opt out and land on the site with a notice.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const email = new URL(req.url).searchParams.get('email');

    if (!email) {
      return NextResponse.redirect(`${SITE_URL}?unsubscribe=invalid`);
    }

    await unsubscribeEmail(email);
    return NextResponse.redirect(`${SITE_URL}?unsubscribe=success`);
  } catch (err) {
    console.error('[GET /api/newsletter/unsubscribe]', err);
    return NextResponse.redirect(`${SITE_URL}?unsubscribe=error`);
  }
}

// One-click unsubscribe (RFC 8058): Gmail/Yahoo/Apple Mail POST here when the
// reader presses their built-in "Unsubscribe" button. Must answer 2xx, no redirect.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const email = new URL(req.url).searchParams.get('email');
    if (email) await unsubscribeEmail(email);
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error('[POST /api/newsletter/unsubscribe]', err);
    return new NextResponse(null, { status: 500 });
  }
}
