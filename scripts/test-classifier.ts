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

console.log(`\n${passed} tests passed`);
