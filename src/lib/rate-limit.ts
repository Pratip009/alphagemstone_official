import { NextRequest, NextResponse } from 'next/server';

/**
 * Shared rate limiter.
 *
 * - If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, uses
 *   Upstash Redis (works correctly across serverless instances / edge).
 * - Otherwise falls back to an in-memory sliding-window counter, which is
 *   fine for local dev or a single-instance deployment but will NOT
 *   coordinate limits across multiple server instances in production.
 *
 * Usage:
 *   const rl = await rateLimit(req, { id: 'login', limit: 5, windowSec: 60 });
 *   if (!rl.success) return rateLimitResponse(rl);
 */

export interface RateLimitOptions {
  /** Logical bucket name, e.g. 'login', 'signup', 'chat' */
  id: string;
  /** Max requests allowed within the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
  /** Optional extra key to combine with IP (e.g. email, sessionId) */
  extraKey?: string;
  /**
   * 'ip' (default): bucket by client IP (+ extraKey if given).
   * 'key': bucket by extraKey alone, ignoring IP. Use this for
   * account-scoped limits so a distributed attack (many IPs, one
   * target account) is still capped.
   */
  scope?: 'ip' | 'key';
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the window resets */
  reset: number;
}

/* ────────────────────────────────────────────────────────────
   IP extraction
──────────────────────────────────────────────────────────── */
export function getClientIp(req: NextRequest): string {
  // Vercel / most proxies set x-forwarded-for: "client, proxy1, proxy2"
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();

  // NextRequest doesn't expose a socket ip in the app router; fall back
  // to a constant so at least all "unknown" clients share one bucket
  // rather than bypassing rate limiting entirely.
  return 'unknown';
}

/* ────────────────────────────────────────────────────────────
   Upstash Redis backend (lazy-loaded, optional dependency)
──────────────────────────────────────────────────────────── */
async function getUpstashLimiter(limit: number, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Cache per (limit, windowSec) combo isn't critical; Ratelimit instances
  // are cheap and stateless on our side (state lives in Redis).
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);

    const redis = new Redis({ url, token });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: false,
    });
  } catch {
    // @upstash/ratelimit / @upstash/redis not installed — fall back to memory.
    return null;
  }
}

/* ────────────────────────────────────────────────────────────
   In-memory fallback backend
──────────────────────────────────────────────────────────── */
type Bucket = { count: number; resetAt: number };
const memoryStore = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow unbounded on a long-lived process.
let lastCleanup = Date.now();
function cleanupMemoryStore() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of memoryStore.entries()) {
    if (bucket.resetAt <= now) memoryStore.delete(key);
  }
}

function memoryRateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  cleanupMemoryStore();
  const now = Date.now();
  const windowMs = windowSec * 1000;

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, reset: Math.ceil(resetAt / 1000) };
  }

  existing.count += 1;
  const success = existing.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: Math.ceil(existing.resetAt / 1000),
  };
}

/* ────────────────────────────────────────────────────────────
   Public API
──────────────────────────────────────────────────────────── */
export async function rateLimit(req: NextRequest, opts: RateLimitOptions): Promise<RateLimitResult> {
  const key =
    opts.scope === 'key' && opts.extraKey
      ? `rl:${opts.id}:${opts.extraKey}`
      : `rl:${opts.id}:${getClientIp(req)}${opts.extraKey ? `:${opts.extraKey}` : ''}`;

  const upstash = await getUpstashLimiter(opts.limit, opts.windowSec);
  if (upstash) {
    const { success, limit, remaining, reset } = await upstash.limit(key);
    return { success, limit, remaining, reset: Math.ceil(reset / 1000) };
  }

  return memoryRateLimit(key, opts.limit, opts.windowSec);
}

/** Standard 429 response with Retry-After + RateLimit-* headers. */
export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(0, result.reset - Math.ceil(Date.now() / 1000));
  return NextResponse.json(
    { success: false, message: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': String(result.remaining),
        'RateLimit-Reset': String(result.reset),
      },
    }
  );
}