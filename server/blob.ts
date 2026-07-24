// Pure binary-payload helpers. NO fs — the actual writing of photos and
// firmware/content artifacts moved behind the StorageDriver seam in
// `server/blobstore/` (DEPLOY_HARDENING §D2), so storage can be swapped for
// S3/R2 in one file instead of at every call site:
//
//   writePhotoJpeg(deviceId, buf)        -> storageDriver.putPhoto(deviceId, buf)
//   writeArtifact(kind, name, buf)       -> storageDriver.putArtifact(kind, name, buf)
//
// The default driver (LocalDiskDriver) reproduces exactly what used to live
// here, so behavior with STORAGE_DRIVER unset is unchanged.

import crypto from "crypto";

export function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
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
