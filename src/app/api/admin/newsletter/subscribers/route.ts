import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { listSubscribers, subscriberStats, exportSubscribers, SourceFilter } from '@/services/newsletter.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { errorResponse } from '@/lib/api-response';

const SOURCES: SourceFilter[] = ['all', 'website', 'legacy', 'account'];

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const rawSource = searchParams.get('source') as SourceFilter | null;
    const source: SourceFilter = rawSource && SOURCES.includes(rawSource) ? rawSource : 'all';

    // ── CSV export ────────────────────────────────────────────────────────────
    if (searchParams.get('export') === 'csv') {
      const rows = ['Email,Name,Source,Subscribed At'];
      for (const sub of await exportSubscribers(source)) {
        rows.push([
          csvCell(sub.email),
          csvCell(sub.name ?? ''),
          sub.source ?? 'website',
          new Date(sub.subscribedAt).toISOString(),
        ].join(','));
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
      listSubscribers({ page, limit, search, status, source }),
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
