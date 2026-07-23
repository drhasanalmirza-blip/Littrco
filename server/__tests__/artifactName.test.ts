import { describe, it, expect } from "vitest";
import { safeExt, artifactStoredName, artifactRelUrl } from "../artifactName";

const SHA = "a".repeat(64);

describe("safeExt", () => {
  it("extracts a plain lowercase extension", () => {
    expect(safeExt("firmware.bin")).toBe(".bin");
    expect(safeExt("WALLPAPER.RAW")).toBe(".raw");
    expect(safeExt("hmi.JSON")).toBe(".json");
  });
  it("strips any path before the name", () => {
    expect(safeExt("/etc/passwd.bin")).toBe(".bin");
    expect(safeExt("..\\..\\win.raw")).toBe(".raw");
  });
  it("returns '' for no extension, dotfiles, or junk extensions", () => {
    expect(safeExt("firmware")).toBe("");
    expect(safeExt(".bashrc")).toBe("");
    expect(safeExt("x.")).toBe("");
    expect(safeExt("x.toolongextension")).toBe(""); // >8 chars
    expect(safeExt("x.b-n")).toBe(""); // non-alphanumeric
    expect(safeExt("")).toBe("");
  });
});

describe("artifactStoredName — path-traversal proof", () => {
  it("names the file by its sha + safe ext, ignoring the client name body", () => {
    expect(artifactStoredName(SHA, "firmware.bin")).toBe(SHA + ".bin");
    expect(artifactStoredName(SHA, "../../../etc/passwd.bin")).toBe(SHA + ".bin");
    expect(artifactStoredName(SHA, "no-ext")).toBe(SHA);
  });
  it("never emits a path separator or traversal from the client filename", () => {
    for (const bad of ["../evil.bin", "a/b/c.raw", "..\\..\\x.json", "x.bin/../../y"]) {
      const name = artifactStoredName(SHA, bad);
      expect(name.includes("/")).toBe(false);
      expect(name.includes("\\")).toBe(false);
      expect(name.includes("..")).toBe(false);
    }
  });
  it("rejects a malformed sha256", () => {
    expect(() => artifactStoredName("nothex", "x.bin")).toThrow();
    expect(() => artifactStoredName("a".repeat(63), "x.bin")).toThrow();
  });
  it("uppercases in the sha are normalized to lowercase", () => {
    expect(artifactStoredName("A".repeat(64), "x.bin")).toBe("a".repeat(64) + ".bin");
  });
});

describe("artifactRelUrl", () => {
  it("builds the served path under /uploads/artifacts/<kind>", () => {
    expect(artifactRelUrl("firmware", SHA + ".bin")).toBe(`/uploads/artifacts/firmware/${SHA}.bin`);
    expect(artifactRelUrl("content", SHA + ".raw")).toBe(`/uploads/artifacts/content/${SHA}.raw`);
  });
});
