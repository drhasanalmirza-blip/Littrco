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

export function isClassifierLabel(value: unknown): value is ClassifierLabel {
  return typeof value === "string" && (VALID_LABELS as string[]).includes(value);
}

export function classifierModel(): string {
  return process.env.CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";
}

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicContentBlock = AnthropicTextBlock | { type: string; [k: string]: unknown };
type AnthropicUsage = {
  input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
};
type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
};

function extractText(resp: AnthropicResponse): string {
  const content = Array.isArray(resp.content) ? resp.content : [];
  for (const block of content) {
    if (block && block.type === "text" && typeof (block as AnthropicTextBlock).text === "string") {
      return (block as AnthropicTextBlock).text.trim();
    }
  }
  return "";
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return {};
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function classifyImage(jpeg: Buffer): Promise<ClassifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const model = classifierModel();
  const resp = (await client.messages.create({
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
  })) as unknown as AnthropicResponse;

  const text = extractText(resp);
  const parsed = parseJsonObject(text);

  const rawLabel = parsed.label;
  const label: ClassifierLabel = isClassifierLabel(rawLabel) ? rawLabel : "uncertain";
  const rawConf = parsed.confidence;
  const confidence =
    typeof rawConf === "number" && Number.isFinite(rawConf)
      ? Math.max(0, Math.min(1, rawConf))
      : 0.5;
  const rawRationale = parsed.rationale;
  const rationale = typeof rawRationale === "string" ? rawRationale.slice(0, 200) : "";

  const usage: AnthropicUsage = resp.usage ?? {};
  const inTok = Number(usage.input_tokens ?? 0);
  const cachedInTok = Number(usage.cache_read_input_tokens ?? 0);
  const outTok = Number(usage.output_tokens ?? 0);
  // Haiku 4.5 pricing per Mtok: input $1.00, cached read $0.10, output $5.00.
  // costMicros = tokens * USD/Mtok (tokens * dollars / 1e6 * 1e6 micros = tokens * dollars).
  const costMicros = Math.ceil(
    (inTok - cachedInTok) * 1.0 + cachedInTok * 0.1 + outTok * 5.0,
  );

  return { label, confidence, rationale, version: `${model}:1`, costMicros };
}

type ImageHashInput = { data: Buffer; ext: string };
type ImageHashFn = (
  input: ImageHashInput,
  bits: number,
  precise: boolean,
  cb: (err: Error | null, hash: string) => void,
) => void;

export function computePHash(jpeg: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    (imageHash as unknown as ImageHashFn)(
      { data: jpeg, ext: "image/jpeg" },
      16,
      true,
      (err, hash) => {
        if (err) reject(err);
        else resolve(hash);
      },
    );
  });
}
