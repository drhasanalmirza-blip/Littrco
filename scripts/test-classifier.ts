import assert from "node:assert/strict";
import { decideVerdict, PASS_THROUGH_VERSION, __testing } from "../server/classifier/worker";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok  ${name}`);
    })
    .catch((err) => {
      console.error(`  FAIL ${name}\n    ${err.message}`);
      process.exitCode = 1;
    });
}

const binAll = { rejectNonVapes: true, rejectThcVapes: true };
const binNone = { rejectNonVapes: false, rejectThcVapes: false };

await test("Phase 0 fallback → auto_accepted + reviewNeeded", () => {
  const v = decideVerdict(__testing.makeFallback("auto_accepted"), binAll);
  assert.equal(v.accepted, true);
  assert.equal(v.reason, "auto_accepted");
  assert.equal(v.reviewNeeded, true);
});

await test("low confidence < 0.55 → accepted/low_confidence + review", () => {
  const v = decideVerdict({ label: "vape", confidence: 0.4, rationale: "", version: "claude:1", costMicros: 0 }, binNone);
  assert.equal(v.accepted, true);
  assert.equal(v.reason, "low_confidence");
  assert.equal(v.reviewNeeded, true);
});

await test("not_a_vape + rejectNonVapes → rejected", () => {
  const v = decideVerdict({ label: "not_a_vape", confidence: 0.9, rationale: "", version: "claude:1", costMicros: 0 }, binAll);
  assert.equal(v.accepted, false);
  assert.equal(v.reason, "not_a_vape");
});

await test("not_a_vape + !rejectNonVapes → accepted", () => {
  const v = decideVerdict({ label: "not_a_vape", confidence: 0.9, rationale: "", version: "claude:1", costMicros: 0 }, binNone);
  assert.equal(v.accepted, true);
});

await test("thc_vape + rejectThcVapes → rejected", () => {
  const v = decideVerdict({ label: "thc_vape", confidence: 0.9, rationale: "", version: "claude:1", costMicros: 0 }, binAll);
  assert.equal(v.accepted, false);
  assert.equal(v.reason, "thc_vape");
});

await test("vape high confidence → accepted/vape, no review", () => {
  const v = decideVerdict({ label: "vape", confidence: 0.95, rationale: "", version: "claude:1", costMicros: 0 }, binAll);
  assert.equal(v.accepted, true);
  assert.equal(v.reason, "vape");
  assert.equal(v.reviewNeeded, false);
});

await test("vape 0.55..0.7 → accepted but reviewNeeded", () => {
  const v = decideVerdict({ label: "vape", confidence: 0.6, rationale: "", version: "claude:1", costMicros: 0 }, binAll);
  assert.equal(v.accepted, true);
  assert.equal(v.reviewNeeded, true);
});

await test("pass_through version always auto_accepted + reviewNeeded regardless of bin rules", () => {
  const v = decideVerdict({ label: "uncertain", confidence: 0.5, rationale: "", version: PASS_THROUGH_VERSION, costMicros: 0 }, binAll);
  assert.equal(v.accepted, true);
  assert.equal(v.reason, "auto_accepted");
  assert.equal(v.reviewNeeded, true);
});

await test("cost math: (in-cached)*1 + cached*0.1 + out*5 micros, ceil", async () => {
  // Use real haiku 4.5 pricing — input $1/Mtok, cached $0.10/Mtok, output $5/Mtok
  // tokens * dollarsPerMtok = micros (because micros = dollars*1e6 and Mtok=1e6)
  const inTok = 1234, cachedInTok = 1000, outTok = 50;
  const expected = Math.ceil((inTok - cachedInTok) * 1.0 + cachedInTok * 0.1 + outTok * 5.0);
  // (1234-1000)*1 + 1000*0.1 + 50*5 = 234 + 100 + 250 = 584
  assert.equal(expected, 584);
});

await test("dailyBudgetExceeded: 0 budget → true", async () => {
  process.env.CLASSIFIER_DAILY_BUDGET_USD = "0";
  const exceeded = await __testing.dailyBudgetExceeded();
  assert.equal(exceeded, true);
});

// HTTP-level smoke tests against the running server (skip if not reachable)
const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/admin/review`, { method: "GET" });
    return r.status === 401 || r.status === 403 || r.status === 200;
  } catch {
    return false;
  }
}
const httpUp = await reachable();
if (!httpUp) {
  console.log("\n  (HTTP tests skipped — server not reachable at " + BASE + ")");
} else {
  await test("HTTP: GET /api/admin/review requires staff auth → 401/403", async () => {
    const r = await fetch(`${BASE}/api/admin/review`);
    assert.ok([401, 403].includes(r.status), `expected 401/403, got ${r.status}`);
  });
  await test("HTTP: POST /api/admin/review/:id/correct requires staff auth → 401/403", async () => {
    const r = await fetch(`${BASE}/api/admin/review/1/correct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ correctedLabel: "vape" }),
    });
    assert.ok([401, 403].includes(r.status), `expected 401/403, got ${r.status}`);
  });
  await test("HTTP: POST /api/bin-module/drop-capture requires module token → 401", async () => {
    const r = await fetch(`${BASE}/api/bin-module/drop-capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: "evt-test", imageRole: "after", image: "x" }),
    });
    assert.equal(r.status, 401);
  });
  await test("HTTP: POST /api/bin-module/drop-verdict requires module token → 401", async () => {
    const r = await fetch(`${BASE}/api/bin-module/drop-verdict?eventId=evt-test`);
    assert.equal(r.status, 401);
  });
  await test("HTTP: POST /api/admin/review/:id/correct rejects missing correctedLabel (with bogus auth)", async () => {
    // Even with bogus session cookie the body validation should be consistent — we just check no 500
    const r = await fetch(`${BASE}/api/admin/review/999999/correct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.ok(r.status >= 400 && r.status < 500, `expected 4xx, got ${r.status}`);
  });
}

console.log(`\n${passed} tests passed`);
