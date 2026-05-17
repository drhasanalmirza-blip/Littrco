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
  // Local /uploads/... path
  if (url.startsWith("/uploads/")) {
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
  // Remote URL — only https, only allowlisted hosts, never internal IPs.
  // SSRF hardening: blocks 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16,
  // ::1, fc00::/7, fe80::/10, link-local metadata endpoints (169.254.169.254).
  if (url.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const allow = (process.env.CLASSIFIER_URL_ALLOWLIST || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const host = parsed.hostname.toLowerCase();
    const hostAllowed = allow.length > 0 && allow.some((a) => host === a || host.endsWith("." + a));
    if (!hostAllowed) return null;
    if (isPrivateOrLocalHost(host)) return null;
    try {
      const resp = await fetch(url, { redirect: "error" });
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  return null;
}

function isPrivateOrLocalHost(host: string): boolean {
  if (host === "localhost" || host === "ip6-localhost" || host === "ip6-loopback") return true;
  // IPv4 literal
  const m4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m4) {
    const o = m4.slice(1, 5).map(Number);
    if (o.some((n) => n < 0 || n > 255)) return true;
    if (o[0] === 10) return true;
    if (o[0] === 127) return true;
    if (o[0] === 0) return true;
    if (o[0] === 169 && o[1] === 254) return true; // link-local + AWS/GCP metadata
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT
    if (o[0] >= 224) return true; // multicast/reserved
    return false;
  }
  // IPv6 literal (very conservative — reject any colon-containing host that
  // looks loopback/link-local/unique-local)
  if (host.includes(":")) {
    const h = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (h === "::1" || h === "::" ) return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:")) {
      const tail = h.slice(7);
      return isPrivateOrLocalHost(tail);
    }
    return false;
  }
  // metadata service hostnames
  if (host === "metadata.google.internal") return true;
  return false;
}

export function uploadsRoot(): string {
  return ROOT;
}
