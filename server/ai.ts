import crypto from "crypto";
import { storage } from "./storage";

export interface AIClassificationResult {
  category: "Nicotine" | "THC" | "Trash" | "Unknown";
  brand: string | null;
  subtype: string | null;
  flavor: string | null;
  confidence: number;
  modelVersion: string;
}

export interface AIProvider {
  name: string;
  classify(imageUrl: string): Promise<AIClassificationResult>;
}

const NULL_RESULT: AIClassificationResult = {
  category: "Unknown",
  brand: null,
  subtype: null,
  flavor: null,
  confidence: 0,
  modelVersion: "null-v1",
};

export const nullProvider: AIProvider = {
  name: "null",
  async classify(_imageUrl: string): Promise<AIClassificationResult> {
    return { ...NULL_RESULT };
  },
};

const OPENAI_MODEL = "gpt-4o";
const OPENAI_MODEL_VERSION = `openai-${OPENAI_MODEL}-v1`;

export const openaiVisionProvider: AIProvider = {
  name: "openai-vision",
  async classify(imageUrl: string): Promise<AIClassificationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[AI] OPENAI_API_KEY not set, falling back to null result");
      return { ...NULL_RESULT, modelVersion: OPENAI_MODEL_VERSION };
    }

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });

    const systemPrompt = `You are an AI classifier for recycled vape/e-cigarette products. Given an image, classify the item into one of these categories:
- Nicotine: disposable vapes, e-cigarettes, nicotine pods
- THC: THC/cannabis vape cartridges or disposables
- Trash: non-vape items, garbage, unrelated objects
- Unknown: cannot determine from the image

Also identify the brand, subtype (model/product line), and flavor if visible.

Respond ONLY with valid JSON in this exact format:
{"category":"Nicotine","brand":"Elf Bar","subtype":"BC5000","flavor":"Blue Razz Ice","confidence":0.92}

Rules:
- confidence is a float between 0 and 1
- brand, subtype, flavor can be null if not identifiable
- category must be one of: Nicotine, THC, Trash, Unknown`;

    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: "Classify this item. Return JSON only.",
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { ...NULL_RESULT, modelVersion: OPENAI_MODEL_VERSION };
    }

    try {
      const parsed = JSON.parse(raw);
      const validCategories = ["Nicotine", "THC", "Trash", "Unknown"];
      const category = validCategories.includes(parsed.category) ? parsed.category : "Unknown";
      const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

      return {
        category,
        brand: parsed.brand || null,
        subtype: parsed.subtype || null,
        flavor: parsed.flavor || null,
        confidence,
        modelVersion: OPENAI_MODEL_VERSION,
      };
    } catch {
      console.error("[AI] Failed to parse OpenAI response:", raw);
      return { ...NULL_RESULT, modelVersion: OPENAI_MODEL_VERSION };
    }
  },
};

export function hashImage(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.3;

export interface AIServiceConfig {
  confidenceThreshold: number;
}

const defaultConfig: AIServiceConfig = {
  confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || String(DEFAULT_CONFIDENCE_THRESHOLD)),
};

function getProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY) {
    return openaiVisionProvider;
  }
  return nullProvider;
}

export async function classifyDrop(
  imageUrl: string,
  imageHash: string | null,
  config: AIServiceConfig = defaultConfig,
): Promise<AIClassificationResult> {
  const provider = getProvider();

  if (imageHash) {
    const existingJob = await findExistingResultByHash(imageHash, provider.name);
    if (existingJob) {
      return existingJob;
    }
  }

  const result = await provider.classify(imageUrl);

  if (result.confidence < config.confidenceThreshold) {
    return {
      ...result,
      category: "Unknown",
    };
  }

  return result;
}

async function findExistingResultByHash(
  hash: string,
  _providerName: string,
): Promise<AIClassificationResult | null> {
  try {
    const image = await storage.getDropImageByHash(hash);
    if (!image) return null;
    // Task #5 made drop_images.dropId nullable (orphan captures linked
    // later by eventId). Legacy AI dedupe path only applies once the
    // image is linked to a drop; skip otherwise.
    if (image.dropId == null) return null;

    const jobs = await storage.getAiJobsByDrop(image.dropId);
    const doneJob = jobs.find(
      (j: any) => j.status === "done" && j.resultJson,
    );
    if (doneJob && doneJob.resultJson) {
      const result = doneJob.resultJson as any;
      if (result.category && typeof result.confidence === "number") {
        return {
          category: result.category,
          brand: result.brand || null,
          subtype: result.subtype || null,
          flavor: result.flavor || null,
          confidence: result.confidence,
          modelVersion: result.modelVersion || "cached",
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function runAiJobForDrop(dropId: number): Promise<AIClassificationResult> {
  const images = await storage.getDropImages(dropId);
  const cropImage = images.find((i: any) => i.imageRole === "crop");
  const afterImage = images.find((i: any) => i.imageRole === "after");
  const targetImage = cropImage || afterImage;

  if (!targetImage) {
    return { ...NULL_RESULT };
  }

  const result = await classifyDrop(targetImage.storageUrl, targetImage.hash);
  return result;
}
