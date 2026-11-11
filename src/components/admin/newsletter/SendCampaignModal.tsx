'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { AUDIENCE_LABELS, Audience, AudienceSummary, Campaign, audienceQuery } from './types';

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

interface Progress { total: number; sent: number; failed: number; remaining: number; done: boolean }

export default function SendCampaignModal({
  campaign,
  authFetch,
  onClose,
  onFinished,
}: {
  campaign: Campaign;
  authFetch: AuthFetch;
  onClose: () => void;
  /** Called whenever the campaign's status may have changed. */
  onFinished: () => void;
}) {
  const resuming = campaign.status === 'sending';
  const audience: Audience = {
    subscribers: campaign.audience?.subscribers ?? true,
    users: campaign.audience?.users ?? false,
    legacy: campaign.audience?.legacy ?? false,
  };

  const [phase, setPhase] = useState<'confirm' | 'sending' | 'done' | 'error'>('confirm');
  const [summary, setSummary] = useState<AudienceSummary | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    if (resuming) return;
    (async () => {
      const res = await authFetch(`/api/admin/newsletter/audience?${audienceQuery(audience)}`);
      const d = await res.json();
      if (d.success) setSummary(d.data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving the page mid-send.
  useEffect(() => {
    if (phase !== 'sending') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  const run = async () => {
    stopRef.current = false;
    setPhase('sending');
    setError('');
    try {
      // Each call sends for up to ~40s; keep calling until the queue is empty.
      for (;;) {
        const res = await authFetch(`/api/admin/newsletter/campaigns/${campaign._id}/send`, { method: 'POST' });
        const d = await res.json();
        if (!d.success) throw new Error(d.message ?? 'Sending failed');
        setProgress(d.data);
        onFinished();
        if (d.data.done) { setPhase('done'); return; }
        if (stopRef.current) { onClose(); return; }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sending failed');
      setPhase('error');
      onFinished();
    }
  };

  const close = () => {
    if (phase === 'sending') {
      if (!confirm('Pause sending? Emails already sent stay sent. You can resume from the campaign list.')) return;
      stopRef.current = true;
      return; // closes after the current chunk returns
    }
    onClose();
  };

  const pct = progress && progress.total > 0 ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const chosen = (Object.keys(AUDIENCE_LABELS) as (keyof Audience)[]).filter(k => audience[k]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Send campaign">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ede9e1]">
          <h2 className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#1a1714]">
            {phase === 'done' ? 'Campaign sent' : resuming ? 'Resume sending' : 'Send campaign'}
          </h2>
          <button onClick={close} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec]"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-[0.92rem] font-semibold text-[#1a1714]">{campaign.title}</p>
            <p className="text-[0.75rem] text-[#a09a90] truncate">{campaign.subject}</p>
          </div>

          {phase === 'confirm' && (
            <>
              {resuming ? (
                <p className="text-[0.8rem] text-[#4a4540] leading-relaxed">
                  This campaign stopped part-way. Resuming sends to everyone who hasn’t received it yet — nobody gets it twice.
                </p>
              ) : (
                <div className="rounded-xl border border-[#ede9e1] divide-y divide-[#f4f1ec]">
                  {chosen.map(k => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[0.78rem]">
                      <span className="text-[#4a4540]">{AUDIENCE_LABELS[k].label}</span>
                      <span className="tabular-nums text-[#1a1714]">{summary ? summary[k].toLocaleString() : '…'}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#faf8f4]">
                    <span className="text-[0.8rem] font-semibold text-[#1a1714]">Unique recipients</span>
                    <span className="text-[1rem] font-semibold tabular-nums text-[#1a1714]">{summary ? summary.total.toLocaleString() : '…'}</span>
                  </div>
                </div>
              )}
              <p className="text-[0.72rem] text-[#a09a90] leading-relaxed">
                Keep this window open while it sends — around 100 emails every second or two. Sending can’t be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7]">Cancel</button>
                <button onClick={run} disabled={!resuming && (!summary || summary.total === 0)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white bg-[#0f172a] hover:opacity-90 disabled:opacity-50">
                  <Send size={14} />
                  {resuming ? 'Resume sending' : summary ? `Send to ${summary.total.toLocaleString()}` : 'Send'}
                </button>
              </div>
            </>
          )}

          {(phase === 'sending' || phase === 'done' || phase === 'error') && (
            <div className="space-y-3">
              <div className="h-2.5 rounded-full bg-[#f4f1ec] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${phase === 'sending' && !progress ? 3 : pct}%`, background: phase === 'error' ? '#ef4444' : '#c9a84c' }} />
              </div>
              <div className="flex items-center justify-between text-[0.75rem]">
                <span className="text-[#4a4540] tabular-nums">
                  {progress ? `${progress.sent.toLocaleString()} of ${progress.total.toLocaleString()} sent` : 'Preparing recipient list…'}
                </span>
                {progress && progress.failed > 0 && <span className="text-red-600 tabular-nums">{progress.failed.toLocaleString()} failed</span>}
              </div>

              {phase === 'sending' && (
                <p className="flex items-center gap-2 text-[0.72rem] text-[#a09a90]"><Loader2 size={13} className="animate-spin" /> Sending — keep this window open.</p>
              )}
              {phase === 'done' && (
                <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-[#f0faf4] border border-[#bbf7d0]">
                  <CheckCircle2 size={16} className="text-green-700 mt-0.5 shrink-0" />
                  <p className="text-[0.75rem] text-green-900">
                    Delivered to {progress?.sent.toLocaleString() ?? 0} {progress?.sent === 1 ? 'person' : 'people'}.
                    {progress && progress.failed > 0 && ' Failed addresses were rejected by the mail provider — usually invalid or closed mailboxes.'}
                  </p>
                </div>
              )}
              {phase === 'error' && (
                <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
                  <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-[0.75rem] text-red-900">{error}. Nothing was sent twice — try again to continue where it stopped.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {phase === 'error' && (
                  <button onClick={run} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white bg-[#0f172a]">Try again</button>
                )}
                {phase !== 'sending' && (
                  <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7]">Close</button>
                )}
                {phase === 'sending' && (
                  <button onClick={close} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7]">Pause</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
