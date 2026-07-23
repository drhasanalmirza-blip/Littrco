import { describe, it, expect } from "vitest";
import { qrMatrix } from "../qr";

// qrMatrix packs the QR module matrix row-major, MSB-first, each row byte-aligned
// (PHASE3_SERVER.md §3.3). QRCode.create is deterministic for a given string, so
// these vectors are stable.

describe("qrMatrix", () => {
  it("produces a plausible, odd module size (>= 21) for a short string", () => {
    const { size } = qrMatrix("LITTR");
    // Version-1 symbol for a short alphanumeric payload is 21x21.
    expect(size).toBe(21);
  });

  it("scales up for a longer payload but stays a valid QR size", () => {
    const { size } = qrMatrix("https://littr.co/claim/0123456789abcdef0123456789abcdef01234567");
    // QR sizes are 21 + 4*(version-1): always >= 21 and odd.
    expect(size).toBeGreaterThanOrEqual(21);
    expect(size % 2).toBe(1);
  });

  it("is deterministic for a fixed string", () => {
    const a = qrMatrix("LITTR");
    const b = qrMatrix("LITTR");
    expect(b.modules).toBe(a.modules);
    expect(b.size).toBe(a.size);
  });

  it("emits a byte-aligned, correctly-sized packed bitmap", () => {
    const { size, modules } = qrMatrix("LITTR");
    const bytes = Buffer.from(modules, "base64");
    const bytesPerRow = Math.ceil(size / 8);
    expect(bytes.length).toBe(bytesPerRow * size);
  });

  it("packs the finder pattern MSB-first (row 0 begins 0xFE)", () => {
    // Every QR code opens each corner with a 7-module finder run followed by a
    // 1-module separator. Row 0, cols 0..6 = 1, col 7 = 0 → first byte 0b11111110.
    // This simultaneously verifies MSB-first ordering and byte alignment.
    const { size, modules } = qrMatrix("LITTR");
    const bytes = Buffer.from(modules, "base64");
    const bytesPerRow = Math.ceil(size / 8);
    expect(bytes[0]).toBe(0xfe);
    // Bottom-left finder: last row also opens with the solid 7-run + separator.
    expect(bytes[(size - 1) * bytesPerRow]).toBe(0xfe);
  });
});
