import type { Request, Response, NextFunction } from "express";

// Small in-memory sliding-window rate limiter (spec §2.7). No external deps.
//
// NOTE: state lives in this process's memory. A multi-instance deployment needs a
// shared store (e.g. Redis) behind the same interface — swap the Map for it there.

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  max: number;
  /** Window length in ms (default 60s). */
  windowMs?: number;
  /** Key extractor; defaults to device id when present, else client IP. */
  keyFn?: (req: Request) => string;
}

function defaultKey(req: Request): string {
  return req.device ? `d:${req.device.id}` : `ip:${req.ip}`;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const keyFn = opts.keyFn ?? defaultKey;
  // key -> ascending timestamps of requests inside the current window
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const cutoff = now - windowMs;

    // Opportunistic sweep so idle keys don't accumulate forever
    if (now - lastSweep > SWEEP_INTERVAL_MS) {
      lastSweep = now;
      hits.forEach((stamps, k) => {
        if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) hits.delete(k);
      });
    }

    const key = keyFn(req);
    let stamps = hits.get(key);
    if (!stamps) {
      stamps = [];
      hits.set(key, stamps);
    }
    // Slide the window: drop timestamps older than windowMs
    while (stamps.length > 0 && stamps[0] <= cutoff) stamps.shift();

    if (stamps.length >= opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Too many requests" });
    }

    stamps.push(now);
    next();
  };
}

/** Per-IP variant (auth/claim endpoints, unauthenticated flows). */
export function rateLimitByIp(max: number, windowMs = 60_000) {
  return rateLimit({ max, windowMs, keyFn: (req) => `ip:${req.ip}` });
}

// The single per-device general limiter (spec §2.7: 120 req/min per device).
// Exported as a shared singleton so every general device route across modules
// (server/routes.ts + server/routes/devops.ts) counts against ONE per-device
// window. A second rateLimit() instance owns its own Map, which would let a
// device spend 120 general + 120 firmware = 240 req/min without a 429.
export const deviceLimiter = rateLimit({ max: 120 });
