// lib/rate-limit.ts — in-memory rate limiter (replaces the Upstash Redis version).
// Throttles brute-force attacks on public endpoints (e.g. /api/kiosk-checkin).
//
// NOTE: in-memory state is per-process. Under serverless (Vercel) each instance
// has its own counter, so the effective limit is multiplied by instance count.
// For a self-hosted single-process deployment (the PB target) this is exact.
// If you need cross-instance limits later, swap this for a Redis/Upstash impl
// with the same exported API.

/**
 * Extract the client IP from a request, trusting x-forwarded-for (first hop)
 * and falling back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  blocked: boolean; // true once the failure threshold is exceeded
  remaining: number; // attempts left in the current window
  retryAfter: number; // seconds until the window resets (0 if not blocked)
}

interface Bucket {
  count: number;
  expiresAt: number; // epoch ms
}

// Module-level map — persists across requests within one process.
const buckets = new Map<string, Bucket>();

// Garbage-collect expired entries occasionally to avoid unbounded growth.
let lastGc = 0;
function gc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, b] of buckets) {
    if (b.expiresAt <= now) buckets.delete(k);
  }
}

/**
 * Record a failed attempt for `key` within a fixed `windowSec` window, capped
 * at `limit`. Returns whether the caller is now blocked from further guessing.
 *
 * A correct attempt should call `clearRateLimit(key)` so a legitimate client
 * (with the right PIN) is never DOS-locked by a spammer.
 */
export async function recordFailure(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  gc(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    // First failure (or window expired) — anchor a fresh window.
    buckets.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return { blocked: false, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }
  bucket.count += 1;
  const blocked = bucket.count > limit;
  const retryAfterMs = bucket.expiresAt - now;
  return {
    blocked,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: blocked ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0,
  };
}

/** Read the current failure count + TTL without incrementing. */
export async function getFailureState(
  key: string,
  limit: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    return { blocked: false, remaining: limit, retryAfter: 0 };
  }
  const blocked = bucket.count > limit;
  return {
    blocked,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: blocked ? Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)) : 0,
  };
}

/** Reset the counter after a successful attempt. */
export async function clearRateLimit(key: string): Promise<void> {
  buckets.delete(key);
}
