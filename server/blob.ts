import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(process.cwd(), "uploads");

export async function writePhotoJpeg(deviceId: number, jpeg: Buffer): Promise<{ url: string; absPath: string }> {
  const dir = path.join(ROOT, "photos", String(deviceId));
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  const absPath = path.join(dir, name);
  await fs.writeFile(absPath, jpeg);
  return { url: `/uploads/photos/${deviceId}/${name}`, absPath };
}

export function decodeDataUrlOrBase64(input: string): Buffer | null {
  if (!input) return null;
  const commaIdx = input.indexOf(",");
  const b64 = input.startsWith("data:") && commaIdx > -1 ? input.slice(commaIdx + 1) : input;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}
