// Object-storage seam (DEPLOY_HARDENING §D2).
//
// WHY `server/blobstore/` and not `server/storage/`: `server/storage.ts` is the
// Drizzle/DB persistence layer, imported as `./storage` / `../storage` from ~20
// modules. Adding a `server/storage/` DIRECTORY next to it makes every one of
// those specifiers ambiguous across three different resolvers (tsc
// `moduleResolution: bundler`, the esbuild bundle in `script/build.ts`, and
// vitest/rollup). They all happen to prefer `storage.ts` over `storage/index.ts`
// today, but the failure mode if any one of them ever flips is "the whole DB
// layer silently resolves to the wrong module". `blobstore` also names what this
// actually is — the successor to `server/blob.ts`, which it takes the write
// paths over from.
//
// This file is the ONLY thing a call site is allowed to know about storage.
// Swapping local disk for S3/R2 must be one new file implementing
// `StorageDriver` plus one line in `./index.ts` — never a hunt through routes.

import type { RequestHandler } from "express";
import type { ArtifactKind } from "../artifactName";

// `local` is the default (and the only implementation shipped). `s3` is
// declared here so the selection error can name it; see TODO(s3) below.
export const STORAGE_DRIVERS = ["local", "s3"] as const;
export type StorageDriverName = (typeof STORAGE_DRIVERS)[number];

export interface PutPhotoResult {
  // Goes straight into photos.storage_url / devices.latest_photo_url and is
  // returned to the device. Root-relative ("/uploads/photos/…") for local disk;
  // an absolute https URL for a bucket driver. Consumers (review queue, training
  // export, dashboards) pass it through verbatim, so both shapes work as-is in
  // an <img src> — but see `absoluteUrl()` for anywhere it gets concatenated.
  url: string;
  // Local disk only: the on-instance absolute path. Undefined for bucket
  // drivers, which have no filesystem. Diagnostics only — nothing may branch on
  // its presence for correctness.
  absPath?: string;
}

export interface PutArtifactResult {
  // Root-relative for local disk (`artifactRelUrl()`), absolute for a bucket
  // driver. Callers that build a public URL MUST use `absoluteUrl()`.
  relUrl: string;
  sha256: string;   // lowercase hex of the stored bytes — the device verifies against this
  sizeBytes: number;
}

// How stored objects are read back. Local disk needs an express.static mount;
// a bucket driver returns null because the bucket/CDN serves the URLs that
// putPhoto/putArtifact already handed out.
export interface StaticMount {
  path: string;
  handler: RequestHandler;
}

export interface StorageDriver {
  readonly name: StorageDriverName;

  // Device photo (drop before/after, idle, maintenance, calibration, live).
  // NOT content-addressed: photos are append-only and each upload is a distinct
  // object, so the key must be unique per call (never derived from caller input).
  putPhoto(deviceId: number, jpeg: Buffer): Promise<PutPhotoResult>;

  // Firmware .bin / content .raw. Content-addressed: the key MUST come from
  // `artifactStoredName(sha256(buf), origName)` so the stored path never
  // contains attacker-controlled bytes beyond a validated extension
  // (artifactName.ts, unit-tested in artifactName.test.ts). Implementations do
  // not get to invent their own naming.
  putArtifact(kind: ArtifactKind, origName: string, buf: Buffer): Promise<PutArtifactResult>;

  // Mounted once at boot by server/index.ts. Null = nothing to serve from this
  // process.
  staticMount(): StaticMount | null;
}

// Make a driver-returned URL absolute. Local disk returns root-relative URLs
// that need the request/BASE_URL origin prefixed; a bucket driver already
// returns an absolute one and must be passed through untouched.
export function absoluteUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return baseUrl.replace(/\/+$/, "") + url;
}

// ---------------------------------------------------------------------------
// TODO(s3) — contract an S3/R2 driver MUST satisfy before `STORAGE_DRIVER=s3`
// is allowed to select it. Deliberately NOT implemented here: it needs an AWS
// SDK (a new runtime dependency) or a hand-rolled SigV4 signer that cannot be
// verified without live credentials. Ship it as `server/blobstore/s3.ts`
// exporting `class S3Driver implements StorageDriver`, and register it in
// `./index.ts`.
//
// 1. CONFIG (all required; `selectDriver()` must fail fast at boot if any is
//    missing — never silently fall back to local disk, that loses objects):
//      S3_ENDPOINT          e.g. https://s3.us-east-1.amazonaws.com
//                           or   https://<accountid>.r2.cloudflarestorage.com
//      S3_BUCKET            bucket name
//      S3_REGION            AWS region; "auto" for R2
//      S3_ACCESS_KEY_ID     write credentials (server-side only, never shipped
//      S3_SECRET_ACCESS_KEY  to the client or the device)
//      S3_PUBLIC_BASE_URL   public origin objects are readable at, no trailing
//                           slash, e.g. https://cdn.littr.co
//
// 2. KEY LAYOUT — mirror the local tree minus the `/uploads` mount:
//      photos/<deviceId>/<epochMs>-<12 hex>.jpg
//      artifacts/<kind>/<sha256><ext>        (kind ∈ firmware|content)
//    Artifact keys MUST be built with `artifactStoredName()` +
//    `artifactRelUrl()` (strip the leading `/uploads/`) so path-traversal
//    proofing and content-addressing stay in exactly one place. Do not
//    interpolate `origName` into a key. Do not accept a caller-supplied key.
//
// 3. PUBLIC URL SHAPE — `putArtifact` returns
//      `${S3_PUBLIC_BASE_URL}/artifacts/${kind}/${storedName}`
//    and `putPhoto` returns `${S3_PUBLIC_BASE_URL}/photos/${deviceId}/${name}`,
//    both absolute. `staticMount()` returns null.
//
//    HARD FIRMWARE CONSTRAINTS on that origin — artifact URLs are stored in
//    firmware_releases.url / content_files.url and fetched by the bin via
//    `cloudDownloadPsram()` (sensor/src/cloud.cpp):
//      a. TLS: the client is `WiFiClientSecure::setCACert(ISRG Root X1)` — a
//         Let's Encrypt-anchored root, NEVER setInsecure. An origin whose cert
//         chains to any other root (raw `*.r2.dev`, most CDN defaults, AWS's
//         Amazon Trust roots) FAILS THE HANDSHAKE and bricks OTA + content
//         packs. Front the bucket with a hostname holding a Let's Encrypt cert
//         (e.g. cdn.littr.co) or bump the pinned root in sensor/include/certs.h
//         and ship that firmware FIRST.
//      b. NO REDIRECTS: `http.begin(); http.GET()` has no
//         setFollowRedirects — anything other than 200 on the first GET aborts
//         the download. So: public anonymous read, not a pre-signed URL (which
//         also expires, while the DB row is permanent), and no 30x from the
//         CDN edge.
//      c. The device sends an `X-Device-Key` header on the download; the origin
//         must ignore unknown headers rather than 400 on them.
//
// 4. CONTENT-TYPE / ENCODING:
//      photos     -> image/jpeg
//      firmware   -> application/octet-stream
//      content    -> application/octet-stream
//    Never text/html (some CDNs sniff-and-rewrite). Never serve artifacts with
//    `Content-Encoding: gzip`: the device SHA-256s the bytes it receives and
//    sizes its ps_malloc buffer from Content-Length, so any transport
//    re-encoding fails verification. Disable CDN compression/optimization for
//    the artifacts prefix.
//
// 5. IMMUTABILITY of SHA-named objects: an `artifacts/` key is its own content
//    hash, so identical uploads dedupe and a key's bytes can never legitimately
//    change. PUT with `If-None-Match: *` (or HEAD-then-skip) and treat an
//    existing key as success — but if a HEAD shows a different size/ETag for
//    the same key, THROW; that means a hash collision or a corrupted object,
//    and overwriting it would silently re-point every device pinned to that
//    SHA. Set `Cache-Control: public, max-age=31536000, immutable` on
//    artifacts, `public, max-age=86400` on photos (matching today's
//    express.static `maxAge: "1d"`). No lifecycle/expiry rule on `artifacts/` —
//    a firmware_releases row can reference an object for years.
//
// 6. DURABILITY SEMANTICS: `putPhoto`/`putArtifact` must throw if the object is
//    not durably stored — returning a URL for bytes that never landed writes a
//    permanently-dangling storage_url. The CALLING ROUTE catches it and returns
//    500 (the try/catch around `putPhoto` in routes.ts
//    `/api/device/drops/:dropId/photos` + `/api/device/photos`, and around
//    `putArtifact` in routes/devops.ts `/api/staff/upload`).
//
//    That is a per-call-site obligation, NOT something the framework does for
//    you: express is pinned at 4.x, which does NOT forward an async handler's
//    rejection to the error middleware in server/index.ts, and there is no
//    asyncHandler/wrap() helper anywhere in server/. A throw from an UNCAUGHT
//    call site therefore sends NO response at all — the caller (a bin on a
//    cellular link) hangs until its own timeout — and, with no
//    `unhandledRejection` listener registered, terminates the process on
//    Node >= 15. ANY NEW CALL SITE MUST CATCH.
//
// 7. MIGRATION: existing rows hold `/uploads/...` URLs. Flipping STORAGE_DRIVER
//    does not rewrite them — copy `uploads/` into the bucket under the key
//    layout above and keep the `/uploads` route serving (or 301ing) until every
//    old row is repointed. New writes go to the bucket immediately.
// ---------------------------------------------------------------------------
