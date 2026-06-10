import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { listSubscribers, subscriberStats } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { errorResponse } from '@/lib/api-response';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    // ── CSV export ────────────────────────────────────────────────────────────
    if (searchParams.get('export') === 'csv') {
      const allActive = await NewsletterSubscriber.find({ status: 'active' })
        .select('email subscribedAt')
        .sort({ subscribedAt: -1 })
        .lean();

      const rows = ['Email,Subscribed At'];
      for (const sub of allActive) {
        rows.push(`${sub.email},${new Date(sub.subscribedAt).toISOString()}`);
      }

      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="subscribers-${Date.now()}.csv"`,
        },
      });
    }

    // ── Paginated list ────────────────────────────────────────────────────────
    const page   = parseInt(searchParams.get('page')   ?? '1', 10);
    const limit  = parseInt(searchParams.get('limit')  ?? '20', 10);
    const search = searchParams.get('search') ?? undefined;
    const status = (searchParams.get('status') as 'active' | 'unsubscribed' | 'all') ?? 'all';

    const [{ subscribers, total }, stats] = await Promise.all([
      listSubscribers({ page, limit, search, status }),
      subscriberStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: subscribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats,
    });
  } catch (err) {
    console.error('[GET /api/admin/newsletter/subscribers]', err);
    return errorResponse('Failed to fetch subscribers', 500);
  }
});
