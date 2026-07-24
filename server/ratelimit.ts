import type { Request, Response, NextFunction } from "express";

// Small sliding-window rate limiter (spec §2.7). No external deps.
//
// The window state lives behind the RateLimitStore seam below. The DEFAULT store
// is a per-process Map — identical to the original implementation, so a
// single-instance deploy behaves exactly as before and needs no env vars. An
// autoscaled deploy multiplies every limit by the instance count; fixing that is
// one file (a shared store), not a hunt through every call site. See TODO(redis).

/** Outcome of recording one request against a key's window. */
export interface RateLimitHit {
  /** true when the request was inside the limit (and has been recorded). */
  allowed: boolean;
  /** Hits inside the window after this call. Informational (remaining = max - count). */
  count: number;
  /** Epoch ms of the oldest hit still in the window; 0 when the window is empty. */
  oldestMs: number;
}

/**
 * Sliding-window counter behind the limiter.
 *
 * `hit()` is ONE atomic step: drop everything older than `now - windowMs`, then
 * either record `now` and allow, or — when the window already holds `max` hits —
 * record nothing and deny. Two rules the middleware depends on:
 *
 *  1. A denied request must NOT be recorded, so a client that keeps hammering
 *     still recovers exactly `windowMs` after its oldest *accepted* hit.
 *  2. `oldestMs` must be in the same clock domain as the `now` passed in
 *     (`Date.now()`), because Retry-After is derived from it.
 *
 * The return may be a promise (a network-backed store); `rateLimit()` handles
 * both. The default store stays synchronous so express middleware stays
 * synchronous in single-process mode.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, max: number, now: number): RateLimitHit | Promise<RateLimitHit>;
}

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  max: number;
  /** Window length in ms (default 60s). */
  windowMs?: number;
  /** Key extractor; defaults to device id when present, else client IP. */
  keyFn?: (req: Request) => string;
  /**
   * Stable name for this limiter, used to namespace its keys in the store so two
   * limiters never share a window. Optional today (each limiter gets its own
   * default store, and an auto id keeps keys apart within the process) but
   * REQUIRED before pointing several processes at one shared store — auto ids
   * depend on module import order and would drift between processes.
   */
  name?: string;
  /** Window store; defaults to a private in-memory store for this limiter. */
  store?: RateLimitStore;
}

function defaultKey(req: Request): string {
  return req.device ? `d:${req.device.id}` : `ip:${req.ip}`;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Per-process in-memory store: `key -> ascending timestamps in the window`.
 * This is the original implementation, moved behind the interface unchanged.
 */
export function createMemoryRateLimitStore(): RateLimitStore {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  return {
    hit(key: string, windowMs: number, max: number, now: number): RateLimitHit {
      const cutoff = now - windowMs;

      // Opportunistic sweep so idle keys don't accumulate forever
      if (now - lastSweep > SWEEP_INTERVAL_MS) {
        lastSweep = now;
        hits.forEach((stamps, k) => {
          if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) hits.delete(k);
        });
      }

      let stamps = hits.get(key);
      if (!stamps) {
        stamps = [];
        hits.set(key, stamps);
      }
      // Slide the window: drop timestamps older than windowMs
      while (stamps.length > 0 && stamps[0] <= cutoff) stamps.shift();

      if (stamps.length >= max) {
        // Denied: nothing is recorded, so the window still drains on schedule.
        return { allowed: false, count: stamps.length, oldestMs: stamps[0] ?? 0 };
      }
      stamps.push(now);
      return { allowed: true, count: stamps.length, oldestMs: stamps[0] };
    },
  };
}

// TODO(redis): shared store for autoscaled deploys. This file must stay
// dependency-free, so the driver belongs in its own module and is injected via
// `RateLimitOptions.store`. A Redis implementation MUST satisfy:
//   * Atomicity — one ZSET per key, one Lua script (or MULTI) per hit:
//       ZREMRANGEBYSCORE key 0 (now - windowMs)      -- slide
//       n = ZCARD key
//       if n >= max: return {0, n, ZRANGE key 0 0 WITHSCORES}   -- deny, record nothing
//       else:        ZADD key now <unique member>; PEXPIRE key windowMs
//                    return {1, n + 1, oldest score}
//     A read-then-write across two round trips races and leaks capacity under load.
//   * Unique members — ZADD member must be unique per hit (e.g. `${now}:${counter}`);
//     reusing the timestamp as the member collapses same-millisecond hits into one.
//   * Key namespace — `rl:{name}:{key}`, using `RateLimitOptions.name`. Without it
//     deviceLimiter's `d:7` and photoLimiter's `d:7` would share one window (today
//     they are separate Maps). Every rateLimit()/rateLimitByIp() call site must be
//     given an explicit `name` before a shared store is switched on.
//   * Expiry — PEXPIRE windowMs on every write, so idle keys self-evict; that is
//     what the in-memory sweep does.
//   * Clock — return `oldestMs` in the caller's `Date.now()` domain (pass `now`
//     through; do not substitute Redis TIME) or Retry-After will be wrong.
//   * Failure policy — rateLimit() fails OPEN when hit() rejects (a limiter outage
//     must not 500 the API). A driver that wants fail-closed on auth endpoints must
//     resolve `{ allowed: false, ... }` itself rather than throwing.

let limiterSeq = 0;

function isPromise(v: RateLimitHit | Promise<RateLimitHit>): v is Promise<RateLimitHit> {
  return typeof (v as Promise<RateLimitHit>).then === "function";
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const keyFn = opts.keyFn ?? defaultKey;
  const store = opts.store ?? createMemoryRateLimitStore();
  // Namespace so one store can back many limiters without merging their windows.
  const scope = opts.name ?? `l${++limiterSeq}`;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${scope}:${keyFn(req)}`;

    const apply = (hit: RateLimitHit) => {
      if (hit.allowed) return next();
      const retryAfterSec = Math.max(1, Math.ceil((hit.oldestMs + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Too many requests" });
    };

    const outcome = store.hit(key, windowMs, opts.max, now);
    // The default store is synchronous — keep that path free of microtask delay.
    if (isPromise(outcome)) {
      outcome.then(apply).catch((err) => {
        console.error("rate limit store failed, allowing request:", err);
        next();
      });
      return;
    }
    return apply(outcome);
  };
}

/** Per-IP variant (auth/claim endpoints, unauthenticated flows). */
export function rateLimitByIp(max: number, windowMs = 60_000, opts: { name?: string; store?: RateLimitStore } = {}) {
  return rateLimit({ max, windowMs, keyFn: (req) => `ip:${req.ip}`, ...opts });
}

// The single per-device general limiter (spec §2.7: 120 req/min per device).
// Exported as a shared singleton so every general device route across modules
// (server/routes.ts + server/routes/devops.ts) counts against ONE per-device
// window. A second rateLimit() instance owns its own store, which would let a
// device spend 120 general + 120 firmware = 240 req/min without a 429.
export const deviceLimiter = rateLimit({ max: 120, name: "device" });
