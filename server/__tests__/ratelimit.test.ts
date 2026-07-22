// Rate-limiter sliding-window behavior (spec §2.7, §8). server/ratelimit.ts is
// pure (type-only express import), so no DATABASE_URL is needed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, rateLimitByIp } from "../ratelimit";

type Middleware = ReturnType<typeof rateLimit>;

function makeReq(opts: { ip?: string; deviceId?: number } = {}) {
  return {
    ip: opts.ip ?? "1.2.3.4",
    device: opts.deviceId !== undefined ? { id: opts.deviceId } : undefined,
  } as any;
}

function hit(mw: Middleware, req: any) {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  let nexted = false;
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  };
  mw(req, res, () => { nexted = true; });
  return { nexted, statusCode, body, headers };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit sliding window", () => {
  it("allows exactly max requests per window, then 429s", () => {
    const mw = rateLimit({ max: 3 });
    const req = makeReq();
    for (let i = 0; i < 3; i++) expect(hit(mw, req).nexted).toBe(true);
    const blocked = hit(mw, req);
    expect(blocked.nexted).toBe(false);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests" });
  });

  it("sets a sane Retry-After (seconds until the oldest hit leaves the window)", () => {
    const mw = rateLimit({ max: 2, windowMs: 60_000 });
    const req = makeReq();
    hit(mw, req);
    vi.advanceTimersByTime(20_000);
    hit(mw, req);
    vi.advanceTimersByTime(10_000); // oldest hit is now 30s old → 30s remain
    const blocked = hit(mw, req);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["Retry-After"])).toBe(30);
  });

  it("slides: capacity returns as old hits age out, not all at once", () => {
    const mw = rateLimit({ max: 2, windowMs: 60_000 });
    const req = makeReq();
    hit(mw, req); // t=0
    vi.advanceTimersByTime(30_000);
    hit(mw, req); // t=30s
    expect(hit(mw, req).statusCode).toBe(429); // both in window
    vi.advanceTimersByTime(31_000); // t=61s: the t=0 hit has aged out, t=30s has not
    expect(hit(mw, req).nexted).toBe(true);
    expect(hit(mw, req).statusCode).toBe(429); // window holds t=30s + t=61s hits
  });

  it("keys by device id when present, isolating devices from each other and from IPs", () => {
    const mw = rateLimit({ max: 1 });
    expect(hit(mw, makeReq({ deviceId: 7 })).nexted).toBe(true);
    expect(hit(mw, makeReq({ deviceId: 7 })).statusCode).toBe(429);
    expect(hit(mw, makeReq({ deviceId: 8 })).nexted).toBe(true); // other device unaffected
    expect(hit(mw, makeReq()).nexted).toBe(true); // keyless (IP) bucket unaffected
  });

  it("keeps separate buckets per IP for unauthenticated requests", () => {
    const mw = rateLimit({ max: 1 });
    expect(hit(mw, makeReq({ ip: "10.0.0.1" })).nexted).toBe(true);
    expect(hit(mw, makeReq({ ip: "10.0.0.1" })).statusCode).toBe(429);
    expect(hit(mw, makeReq({ ip: "10.0.0.2" })).nexted).toBe(true);
  });

  it("gives each limiter instance its own state", () => {
    const a = rateLimit({ max: 1 });
    const b = rateLimit({ max: 1 });
    const req = makeReq();
    expect(hit(a, req).nexted).toBe(true);
    expect(hit(b, req).nexted).toBe(true); // b has not seen this key
    expect(hit(a, req).statusCode).toBe(429);
  });
});

describe("rateLimitByIp", () => {
  it("keys by IP even when a device is attached to the request", () => {
    const mw = rateLimitByIp(1);
    expect(hit(mw, makeReq({ ip: "10.9.9.9", deviceId: 42 })).nexted).toBe(true);
    // Different device, same IP — still the same bucket
    expect(hit(mw, makeReq({ ip: "10.9.9.9", deviceId: 43 })).statusCode).toBe(429);
  });

  it("honors a custom window length", () => {
    const mw = rateLimitByIp(1, 10_000);
    const req = makeReq({ ip: "10.1.1.1" });
    expect(hit(mw, req).nexted).toBe(true);
    expect(hit(mw, req).statusCode).toBe(429);
    vi.advanceTimersByTime(10_001);
    expect(hit(mw, req).nexted).toBe(true);
  });
});
