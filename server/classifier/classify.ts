import { imageHash } from "image-hash";

export type ClassifierLabel = "vape" | "thc_vape" | "not_a_vape" | "uncertain";

export type ClassifyResult = {
  label: ClassifierLabel;
  confidence: number;
  rationale: string;
  version: string;
  costMicros: number;
};

const SYSTEM = `You analyze a single photo of an object dropped into a vape
recycling bin in a corner store. Output ONLY a JSON object — no prose, no
markdown:

{ "label": "vape" | "thc_vape" | "not_a_vape" | "uncertain",
  "confidence": <number 0..1>,
  "rationale": "<one short sentence>" }

Definitions:
- "vape": any disposable or rechargeable nicotine vape (Elf Bar, Vuse, Juul, etc.)
- "thc_vape": cannabis/THC cartridge, pen, or rechargeable battery + cartridge.
  These are typically darker, often have a glass cartridge with visible oil.
- "not_a_vape": anything else (lighter, gum, trash, finger, empty frame).
- "uncertain": visibility poor, partially occluded, motion blur, or genuinely ambiguous.

Err toward "uncertain" rather than guessing. Don't claim high confidence on a
blurry photo.`;

const VALID_LABELS: ClassifierLabel[] = ["vape", "thc_vape", "not_a_vape", "uncertain"];

export function classifierModel(): string {
  return process.env.CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";
}

export async function classifyImage(jpeg: Buffer): Promise<ClassifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const model = classifierModel();
  const resp = await client.messages.create({
    model,
    max_tokens: 200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
          },
          { type: "text", text: "Classify this image." },
        ],
      },
    ],
  });

  const block = (resp.content || []).find((c: any) => c.type === "text") as any;
  const text = (block?.text || "").trim();
  let parsed: any = {};
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    parsed = { label: "uncertain", confidence: 0.5, rationale: "parse_error" };
  }
  const label: ClassifierLabel = VALID_LABELS.includes(parsed.label) ? parsed.label : "uncertain";
  const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  const rationale = typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 200) : "";

  const usage: any = resp.usage || {};
  const inTok = usage.input_tokens || 0;
  const cachedInTok = usage.cache_read_input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  // Haiku 4.5 pricing per Mtok: input $1.00, cached read $0.10, output $5.00
  // costMicros = sum( tokens * $/Mtok ) since (tokens * dollars / 1_000_000) * 1_000_000 micros = tokens * dollars
  const costMicros = Math.ceil(
    (inTok - cachedInTok) * 1.0 + cachedInTok * 0.1 + outTok * 5.0,
  );

  return {
    label,
    confidence,
    rationale,
    version: `${model}:1`,
    costMicros,
  };
}

export function computePHash(jpeg: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash({ data: jpeg, ext: "image/jpeg" } as any, 16, true, (err: any, hash: string) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
}
