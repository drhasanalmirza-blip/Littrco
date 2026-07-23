import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { artifactStoredName, artifactRelUrl, type ArtifactKind } from "./artifactName";

const ROOT = path.resolve(process.cwd(), "uploads");

export async function writePhotoJpeg(deviceId: number, jpeg: Buffer): Promise<{ url: string; absPath: string }> {
  const dir = path.join(ROOT, "photos", String(deviceId));
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  const absPath = path.join(dir, name);
  await fs.writeFile(absPath, jpeg);
  return { url: `/uploads/photos/${deviceId}/${name}`, absPath };
}

export function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Store a firmware/content artifact (P3-S0). Content-addressed by SHA-256 so the
// server owns both the path and the hash the device will verify against. Returns
// a root-relative URL; the caller makes it absolute (littr.co) for the DB row.
// NOTE: local disk is per-instance ephemeral on autoscaled hosting — swap this
// body for S3/R2 before multi-instance deployment (ROADMAP pre-deploy checklist).
export async function writeArtifact(
  kind: ArtifactKind,
  origName: string,
  buf: Buffer,
): Promise<{ relUrl: string; sha256: string; sizeBytes: number }> {
  const sha256 = sha256Hex(buf);
  const name = artifactStoredName(sha256, origName);
  const dir = path.join(ROOT, "artifacts", kind);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return { relUrl: artifactRelUrl(kind, name), sha256, sizeBytes: buf.length };
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
