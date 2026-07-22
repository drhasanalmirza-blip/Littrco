import { describe, it, expect } from "vitest";
import { PAIR_CODE_ALPHABET, PAIR_CODE_LENGTH, generatePairCode } from "../paircode";

describe("pair-code alphabet", () => {
  it("has exactly 32 characters", () => {
    expect(PAIR_CODE_ALPHABET).toHaveLength(32);
  });

  it("has no duplicate characters", () => {
    expect(new Set(PAIR_CODE_ALPHABET).size).toBe(PAIR_CODE_ALPHABET.length);
  });

  it("is uppercase alphanumeric only", () => {
    expect(PAIR_CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
  });

  it("excludes the look-alikes 0, O, 1, I", () => {
    for (const banned of ["0", "O", "1", "I"]) {
      expect(PAIR_CODE_ALPHABET).not.toContain(banned);
    }
  });
});

describe("generatePairCode", () => {
  it("returns 6-character codes", () => {
    expect(PAIR_CODE_LENGTH).toBe(6);
    for (let i = 0; i < 100; i++) {
      expect(generatePairCode()).toHaveLength(6);
    }
  });

  it("only ever uses alphabet characters (never 0/O/1/I)", () => {
    for (let i = 0; i < 500; i++) {
      const code = generatePairCode();
      for (const ch of code) {
        expect(PAIR_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("produces varied codes (crypto-random, not constant)", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePairCode()));
    // 32^6 code space — 200 draws colliding to under 100 uniques would be broken
    expect(codes.size).toBeGreaterThan(100);
  });

  it("uses every alphabet character across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000 && seen.size < 32; i++) {
      for (const ch of generatePairCode()) seen.add(ch);
    }
    // 12000 characters drawn; missing one of 32 symbols is ~(31/32)^12000 ≈ 0
    expect(seen.size).toBe(32);
  });
});
