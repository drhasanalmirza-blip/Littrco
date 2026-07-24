import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LocalDiskDriver, absoluteUrl, createDriver, parseDriverName } from "../blobstore";

// Storage seam (DEPLOY_HARDENING §D2). These lock in that the DEFAULT driver
// reproduces the pre-seam local-disk behavior exactly, and that the
// content-addressing / path-traversal guarantees survive the indirection.
// Everything writes into a temp dir — never the repo's uploads/.

let root: string;
let driver: LocalDiskDriver;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "littr-blobstore-"));
  driver = new LocalDiskDriver(root);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("driver selection", () => {
  it("defaults to local when STORAGE_DRIVER is unset or empty", () => {
    expect(parseDriverName(undefined)).toBe("local");
    expect(parseDriverName("")).toBe("local");
    expect(parseDriverName("  ")).toBe("local");
    expect(parseDriverName("LOCAL")).toBe("local");
    expect(createDriver("local").name).toBe("local");
  });
  it("rejects an unknown driver name instead of silently using local disk", () => {
    expect(() => parseDriverName("gcs")).toThrow(/not a known driver/);
    expect(() => parseDriverName("s3 ; rm -rf")).toThrow(/not a known driver/);
  });
  it("accepts s3 as a name but refuses to construct it (no unverified client)", () => {
    expect(parseDriverName("s3")).toBe("s3");
    expect(() => createDriver("s3")).toThrow(/TODO\(s3\)/);
  });
});

describe("LocalDiskDriver.putPhoto", () => {
  it("writes under photos/<deviceId>/ and returns the /uploads URL for that file", async () => {
    const { url, absPath } = await driver.putPhoto(42, Buffer.from("jpegbytes"));
    expect(url).toMatch(/^\/uploads\/photos\/42\/\d+-[0-9a-f]{12}\.jpg$/);
    expect(absPath).toBe(path.join(root, "photos", "42", path.basename(url)));
    expect(await fs.readFile(absPath!, "utf8")).toBe("jpegbytes");
  });
  it("never collides — every upload is its own object", async () => {
    const buf = Buffer.from("same-bytes");
    const a = await driver.putPhoto(7, buf);
    const b = await driver.putPhoto(7, buf);
    expect(a.url).not.toBe(b.url);
  });
});

describe("LocalDiskDriver.putArtifact", () => {
  const bin = Buffer.from("firmware-image");

  it("is content-addressed: stored name and relUrl are the sha256 + safe ext", async () => {
    const r = await driver.putArtifact("firmware", "littr-sensor-v1.2.3.bin", bin);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.sizeBytes).toBe(bin.length);
    expect(r.relUrl).toBe(`/uploads/artifacts/firmware/${r.sha256}.bin`);
    expect(await fs.readFile(path.join(root, "artifacts", "firmware", `${r.sha256}.bin`))).toEqual(bin);
  });

  it("identical bytes dedupe onto one object", async () => {
    const a = await driver.putArtifact("content", "wallpaper.raw", Buffer.from("pixels"));
    const b = await driver.putArtifact("content", "OTHER-NAME.raw", Buffer.from("pixels"));
    expect(b.relUrl).toBe(a.relUrl);
    const dir = await fs.readdir(path.join(root, "artifacts", "content"));
    expect(dir.filter((f) => f === `${a.sha256}.raw`)).toHaveLength(1);
  });

  it("a traversal filename cannot escape the artifacts dir", async () => {
    const r = await driver.putArtifact("firmware", "../../../../etc/cron.d/evil.bin", bin);
    expect(r.relUrl).toBe(`/uploads/artifacts/firmware/${r.sha256}.bin`);
    // The only thing written is inside artifacts/firmware/.
    const dir = await fs.readdir(path.join(root, "artifacts", "firmware"));
    expect(dir.every((f) => /^[0-9a-f]{64}(\.[a-z0-9]{1,8})?$/.test(f))).toBe(true);
  });
});

describe("staticMount", () => {
  it("local disk serves its own root at /uploads (matching artifactRelUrl)", () => {
    const mount = driver.staticMount();
    expect(mount.path).toBe("/uploads");
    expect(typeof mount.handler).toBe("function");
  });
});

describe("absoluteUrl", () => {
  it("prefixes a root-relative (local-disk) url with the request origin", () => {
    expect(absoluteUrl("/uploads/artifacts/firmware/x.bin", "https://littr.co"))
      .toBe("https://littr.co/uploads/artifacts/firmware/x.bin");
    expect(absoluteUrl("/uploads/x.bin", "https://littr.co/")).toBe("https://littr.co/uploads/x.bin");
  });
  it("passes an already-absolute (bucket) url through untouched", () => {
    expect(absoluteUrl("https://cdn.littr.co/artifacts/firmware/x.bin", "https://littr.co"))
      .toBe("https://cdn.littr.co/artifacts/firmware/x.bin");
  });
});
