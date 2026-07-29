/**
 * Fixed-window in-memory rate limiter. Suitable for a single server instance;
 * on serverless/multi-instance deployments swap the store for Upstash Redis
 * (@upstash/ratelimit) — the call sites won't need to change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const win = windows.get(key);
  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (win.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000) };
  }
  win.count++;
  return { ok: true, retryAfterSeconds: 0 };
}

// Bound memory: sweep expired windows occasionally.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) if (win.resetAt <= now) windows.delete(key);
}, 60_000).unref?.();
