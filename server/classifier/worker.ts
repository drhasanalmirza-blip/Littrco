import { storage } from "../storage";
import { readCaptureByUrl } from "../blob";
import { classifyImage, computePHash, classifierModel, type ClassifierLabel, type ClassifyResult } from "./classify";

type Verdict = {
  accepted: boolean;
  reason: string;
  reviewNeeded: boolean;
};

const PASS_THROUGH_VERSION = "pass_through:1";
const LOW_CONF = 0.55;
const REVIEW_CONF = 0.7;

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function makeFallback(reason: string): ClassifyResult {
  return {
    label: "uncertain",
    confidence: 0.5,
    rationale: reason,
    version: PASS_THROUGH_VERSION,
    costMicros: 0,
  };
}

function decideVerdict(
  result: ClassifyResult,
  bin: { rejectNonVapes: boolean | null; rejectThcVapes: boolean | null },
): Verdict {
  if (result.confidence < LOW_CONF) {
    return { accepted: true, reason: "low_confidence", reviewNeeded: true };
  }
  if (result.label === "not_a_vape" && bin.rejectNonVapes) {
    return { accepted: false, reason: "not_a_vape", reviewNeeded: true };
  }
  if (result.label === "thc_vape" && bin.rejectThcVapes) {
    return { accepted: false, reason: "thc_vape", reviewNeeded: true };
  }
  const reviewNeeded =
    result.label === "uncertain" ||
    result.confidence < REVIEW_CONF ||
    result.version.startsWith("pass_through");
  return { accepted: true, reason: result.label, reviewNeeded };
}

async function dailyBudgetExceeded(): Promise<boolean> {
  const capCents = parseFloat(process.env.CLASSIFIER_DAILY_USD_CAP || "0.50");
  if (!capCents || capCents <= 0) return false;
  const spentMicros = await storage.getClassifierCostMicrosForDay(dayKey());
  return spentMicros / 1_000_000 >= capCents;
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

    const provider = (process.env.CLASSIFIER_PROVIDER || "off").toLowerCase();
    const jpeg = await readCaptureByUrl(storageUrl);

    let phash: string | null = null;
    if (jpeg) {
      try {
        phash = await computePHash(jpeg);
      } catch {
        phash = null;
      }
    }

    let result: ClassifyResult | null = null;
    let cacheHit = false;

    // pHash dedupe: if any prior image with same pHash has a classifier result, reuse it
    if (phash) {
      const prior = await storage.findClassifierResultByPhash(phash);
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
      if (provider === "off" || !process.env.ANTHROPIC_API_KEY) {
        result = makeFallback(provider === "off" ? "provider_off" : "no_api_key");
      } else if (await dailyBudgetExceeded()) {
        result = makeFallback("budget_exceeded");
      } else if (!jpeg) {
        result = makeFallback("image_unreadable");
      } else {
        try {
          result = await classifyImage(jpeg);
        } catch (err: any) {
          console.error("[classifier] classifyImage failed:", err?.message || err);
          result = makeFallback("classify_error");
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
        imageId,
        version: result.version,
        costMicros: result.costMicros,
        cacheHit,
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
  } catch (err: any) {
    console.error("[classifier] processCapture fatal:", err?.message || err);
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

export const __testing = { decideVerdict, makeFallback, PASS_THROUGH_VERSION };
