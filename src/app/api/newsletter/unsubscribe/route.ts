import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.redirect(`${SITE_URL}?unsubscribe=invalid`);
    }

    await NewsletterSubscriber.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { status: 'unsubscribed' } }
    );

    return NextResponse.redirect(`${SITE_URL}?unsubscribe=success`);
  } catch (err) {
    console.error('[GET /api/newsletter/unsubscribe]', err);
    return NextResponse.redirect(`${SITE_URL}?unsubscribe=error`);
  }
}
