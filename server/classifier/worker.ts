import { storage } from "../storage";
import { readCaptureByUrl } from "../blob";
import { classifierConfig } from "../config";
import { classifyImage, computePHash, type ClassifierLabel, type ClassifyResult } from "./classify";

type Verdict = {
  accepted: boolean;
  reason: string;
  reviewNeeded: boolean;
};

export const PASS_THROUGH_VERSION = "pass_through:1";
const LOW_CONF = 0.55;
const REVIEW_CONF = 0.7;

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// Phase 0 / budget-exceeded fallback: auto-accept with review flag, per spec.
function makeFallback(rationale: string): ClassifyResult {
  return {
    label: "uncertain",
    confidence: 0.5,
    rationale,
    version: PASS_THROUGH_VERSION,
    costMicros: 0,
  };
}

export function decideVerdict(
  result: ClassifyResult,
  bin: { rejectNonVapes: boolean | null; rejectThcVapes: boolean | null },
): Verdict {
  // Spec rule (applies uniformly, including to hard-reject outcomes):
  //   reviewNeeded = (label == "uncertain") || (confidence < 0.7) ||
  //                  (version startsWith "pass_through")
  const reviewNeeded =
    result.label === "uncertain" ||
    result.confidence < REVIEW_CONF ||
    result.version.startsWith("pass_through");

  // Phase 0 / fallback: explicit auto-accept with the review flag set.
  if (result.version.startsWith("pass_through")) {
    return { accepted: true, reason: "auto_accepted", reviewNeeded };
  }
  if (result.confidence < LOW_CONF) {
    return { accepted: true, reason: "low_confidence", reviewNeeded };
  }
  if (result.label === "not_a_vape" && bin.rejectNonVapes) {
    return { accepted: false, reason: "not_a_vape", reviewNeeded };
  }
  if (result.label === "thc_vape" && bin.rejectThcVapes) {
    return { accepted: false, reason: "thc_vape", reviewNeeded };
  }
  return { accepted: true, reason: result.label, reviewNeeded };
}

async function dailyBudgetExceeded(): Promise<boolean> {
  const capUsd = classifierConfig.dailyBudgetUsd;
  if (!capUsd || capUsd <= 0) return true; // 0 cap means immediately exceeded
  const spentMicros = await storage.getClassifierCostMicrosForDay(dayKey());
  return spentMicros / 1_000_000 >= capUsd;
}

export async function processCapture(args: {
  eventId: string;
  binId: number;
  imageId: number;
  storageUrl: string;
}): Promise<void> {
  const { eventId, binId, imageId, storageUrl } = args;
  try {
    const bin = await storage.getBin(binId);
    if (!bin) return;

    const provider = classifierConfig.provider;

    // Always read bytes and compute pHash when possible, even in Phase 0
    // — the spec requires Phase 0 captures to be stored AND hashed (the
    // hash is used by future Phase 1 dedupe and by ops tooling). Failure
    // to fetch bytes is non-fatal; we still record a pass_through verdict.
    const jpeg: Buffer | null = await readCaptureByUrl(storageUrl);
    let phash: string | null = null;
    if (jpeg) {
      try {
        phash = await computePHash(jpeg);
      } catch {
        phash = null;
      }
    }

    // Phase 0 hard short-circuit: when provider is off / key missing /
    // budget exceeded, every capture MUST resolve to a pass_through
    // auto_accepted fallback regardless of any prior cached result. The
    // pHash is still computed and persisted above, but dedupe LOOKUP is
    // skipped so a previously Anthropic-labeled pHash can never leak a
    // non-pass_through verdict into Phase 0 operation.
    const phase0 =
      provider === "off" ||
      !classifierConfig.hasApiKey ||
      (await dailyBudgetExceeded());

    let result: ClassifyResult | null = null;
    let cacheHit = false;

    if (phase0) {
      result = makeFallback("auto_accepted");
    } else {
      // pHash dedupe (Phase 1 only): reuse a prior result within TTL.
      if (phash) {
        const prior = await storage.findClassifierResultByPhash(phash, classifierConfig.dedupeHours);
        if (prior) {
          result = {
            label: (prior.classifierLabel as ClassifierLabel) || "uncertain",
            confidence: prior.classifierConfidence ?? 0.5,
            rationale: "phash_dedupe",
            version: prior.classifierVersion || PASS_THROUGH_VERSION,
            costMicros: 0,
          };
          cacheHit = true;
        }
      }

      if (!result) {
        if (!jpeg) {
          result = makeFallback("auto_accepted");
        } else {
          try {
            result = await classifyImage(jpeg);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[classifier] classifyImage failed:", msg);
            result = makeFallback("classify_error");
          }
        }
      }
    }

    await storage.updateDropImageClassifier(imageId, {
      phash,
      classifierLabel: result.label,
      classifierConfidence: result.confidence,
      classifierRanAt: new Date(),
      classifierVersion: result.version,
      classifierCostMicros: result.costMicros,
    });

    if (result.costMicros > 0 || !cacheHit) {
      await storage.recordClassifierCost({
        day: dayKey(),
        totalMicros: result.costMicros,
        callCount: cacheHit ? 0 : 1,
      });
    }

    const verdict = decideVerdict(result, {
      rejectNonVapes: bin.rejectNonVapes ?? false,
      rejectThcVapes: bin.rejectThcVapes ?? false,
    });

    await storage.updateDropByEventId(eventId, {
      verdictReady: true,
      verdictAccepted: verdict.accepted,
      verdictReason: verdict.reason,
      verdictDecidedAt: new Date(),
      verdictReviewNeeded: verdict.reviewNeeded,
      // Do NOT set rewardClaimed here. A verdict being decided is not the
      // same as the customer having claimed the reward — corrections must
      // remain possible until a real claim event flips rewardClaimed.
      status: verdict.accepted ? "approved" : "denied",
      category:
        result.label === "vape"
          ? "Nicotine"
          : result.label === "thc_vape"
            ? "THC"
            : result.label === "not_a_vape"
              ? "Trash"
              : "Unknown",
      aiConfidence: result.confidence,
      aiModelVersion: result.version,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[classifier] processCapture fatal:", msg);
    try {
      await storage.updateDropByEventId(eventId, {
        verdictReady: true,
        verdictAccepted: true,
        verdictReason: "worker_error",
        verdictDecidedAt: new Date(),
        verdictReviewNeeded: true,
      });
    } catch {}
  }
}

export const __testing = { decideVerdict, makeFallback, PASS_THROUGH_VERSION, dailyBudgetExceeded };
