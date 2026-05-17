import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(process.cwd(), "uploads");

export async function writeCaptureJpeg(binId: number | null, jpeg: Buffer): Promise<{ url: string; absPath: string }> {
  const bin = binId ?? 0;
  const dir = path.join(ROOT, "captures", String(bin));
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  const absPath = path.join(dir, name);
  await fs.writeFile(absPath, jpeg);
  const url = `/uploads/captures/${bin}/${name}`;
  return { url, absPath };
}

export async function readCaptureByUrl(url: string): Promise<Buffer | null> {
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.slice("/uploads/".length);
  const abs = path.resolve(ROOT, rel);
  // Prevent path traversal: resolved path must remain inside ROOT
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (abs !== ROOT && !abs.startsWith(rootWithSep)) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export function uploadsRoot(): string {
  return ROOT;
}
