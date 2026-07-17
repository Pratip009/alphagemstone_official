import { NextRequest, NextResponse } from 'next/server';
import {
  runDueSoonReminders,
  runOverdueSweep,
  runEscalationSweep,
  syncMemoTrackingStatuses,
} from '@/services/memo.service';

// Same auth pattern as src/app/api/cron/sync-deliveries/route.ts:
// Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization');
  if (bearer === `Bearer ${secret}`) return true;
  const { searchParams } = new URL(req.url);
  return searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Sequential, not Promise.all — mirrors sync-deliveries' rate-limit-respecting
  // pattern, since each step may call ShipEngine per-memo.
  const results: Record<string, number | string> = {};

  try {
    results.dueSoonReminders = await runDueSoonReminders();
  } catch (err) {
    console.error('memo-reminders: runDueSoonReminders failed', err);
    results.dueSoonReminders = 'error';
  }

  try {
    results.overdueFlipped = await runOverdueSweep();
  } catch (err) {
    console.error('memo-reminders: runOverdueSweep failed', err);
    results.overdueFlipped = 'error';
  }

  try {
    results.escalated = await runEscalationSweep();
  } catch (err) {
    console.error('memo-reminders: runEscalationSweep failed', err);
    results.escalated = 'error';
  }

  try {
    results.trackingSynced = await syncMemoTrackingStatuses();
  } catch (err) {
    console.error('memo-reminders: syncMemoTrackingStatuses failed', err);
    results.trackingSynced = 'error';
  }

  return NextResponse.json({ success: true, data: results });
}
