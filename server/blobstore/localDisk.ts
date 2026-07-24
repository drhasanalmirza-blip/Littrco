// Local-disk StorageDriver — the default, and byte-for-byte today's behavior.
//
// Every line here is lifted verbatim from the pre-seam `server/blob.ts` +
// the `/uploads` express.static mount in `server/index.ts`: same root, same
// directory layout, same filename scheme, same URLs, same static options. With
// STORAGE_DRIVER unset the owner's Replit deploy is unchanged.
//
// Known limitation (the reason the seam exists — DEPLOY_HARDENING §D2): these
// objects live on one instance's filesystem, so on autoscaled/ephemeral hosting
// they 404 from sibling instances and vanish on redeploy. That breaks
// review-queue photos AND the OTA/content-pack downloads bins depend on.

import express from "express";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { artifactStoredName, artifactRelUrl, type ArtifactKind } from "../artifactName";
import { sha256Hex } from "../blob";
import type { PutArtifactResult, PutPhotoResult, StaticMount, StorageDriver } from "./driver";

// Public mount for the uploads tree. MUST stay "/uploads" — `artifactRelUrl()`
// hardcodes that prefix and its unit test asserts it.
const UPLOADS_MOUNT = "/uploads";

export class LocalDiskDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  // Default root resolves at construction (= boot), matching the module-load
  // `path.resolve(process.cwd(), "uploads")` this replaced. The parameter exists
  // so tests can point at a temp dir instead of writing into the repo.
  constructor(root?: string) {
    this.root = root ?? path.resolve(process.cwd(), "uploads");
  }

  async putPhoto(deviceId: number, jpeg: Buffer): Promise<PutPhotoResult> {
    const dir = path.join(this.root, "photos", String(deviceId));
    await fs.mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
    const absPath = path.join(dir, name);
    await fs.writeFile(absPath, jpeg);
    return { url: `${UPLOADS_MOUNT}/photos/${deviceId}/${name}`, absPath };
  }

  // Content-addressed by SHA-256 so the server owns both the path and the hash
  // the device verifies against, and identical uploads dedupe onto one file.
  // The stored name comes from artifactName.ts — never from `origName` beyond a
  // validated extension.
  async putArtifact(kind: ArtifactKind, origName: string, buf: Buffer): Promise<PutArtifactResult> {
    const sha256 = sha256Hex(buf);
    const name = artifactStoredName(sha256, origName);
    const dir = path.join(this.root, "artifacts", kind);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buf);
    return { relUrl: artifactRelUrl(kind, name), sha256, sizeBytes: buf.length };
  }

  staticMount(): StaticMount {
    return {
      path: UPLOADS_MOUNT,
      handler: express.static(this.root, { maxAge: "1d", index: false }),
    };
  }
}
