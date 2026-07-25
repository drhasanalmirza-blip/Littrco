import { describe, it, expect } from "vitest";
import {
  IMPACT_FACTORS,
  lithiumGrams,
  ewasteGrams,
  co2eKg,
  phoneBatteryEquivalents,
  formatMass,
} from "@shared/impact";

describe("safe input handling", () => {
  // The dashboard feeds these straight from an API response, so a missing or
  // malformed count must render 0 — never NaN, never a negative "achievement".
  const junk = [0, -1, -1000, NaN, Infinity, -Infinity];

  it("clamps junk input to zero for every metric", () => {
    for (const v of junk) {
      expect(lithiumGrams(v)).toBe(0);
      expect(ewasteGrams(v)).toBe(0);
      expect(phoneBatteryEquivalents(v)).toBe(0);
    }
  });

  it("floors fractional counts (you cannot recycle half a vape)", () => {
    expect(ewasteGrams(2.9)).toBe(ewasteGrams(2));
  });
});

describe("lithiumGrams", () => {
  it("is zero for zero vapes", () => {
    expect(lithiumGrams(0)).toBe(0);
  });

  it("scales with the configured factor", () => {
    expect(lithiumGrams(100)).toBeCloseTo(100 * IMPACT_FACTORS.LITHIUM_G_PER_VAPE, 5);
  });

  it("never over-claims — the shown value is <= the true value", () => {
    for (const n of [1, 7, 13, 99, 1234]) {
      expect(lithiumGrams(n)).toBeLessThanOrEqual(n * IMPACT_FACTORS.LITHIUM_G_PER_VAPE);
    }
  });

  it("is monotonic in the number of vapes", () => {
    let prev = -1;
    for (const n of [0, 1, 10, 100, 1000, 10000]) {
      const v = lithiumGrams(n);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("ewasteGrams", () => {
  it("is a straight multiple of device mass", () => {
    expect(ewasteGrams(1)).toBe(IMPACT_FACTORS.DEVICE_MASS_G_PER_VAPE);
    expect(ewasteGrams(40)).toBe(40 * IMPACT_FACTORS.DEVICE_MASS_G_PER_VAPE);
  });

  it("handles a large lifetime count without precision loss", () => {
    expect(ewasteGrams(100_000)).toBe(100_000 * IMPACT_FACTORS.DEVICE_MASS_G_PER_VAPE);
  });
});

describe("co2eKg — tripwire", () => {
  // This test exists to FAIL when someone sets CO2E_KG_PER_VAPE to a number.
  // That is intentional: enabling a public CO2 claim must be a deliberate act
  // that forces a review of the sourcing, not a silent constant edit.
  it("returns null while no defensible LCA factor is configured", () => {
    expect(IMPACT_FACTORS.CO2E_KG_PER_VAPE).toBeNull();
    expect(co2eKg(0)).toBeNull();
    expect(co2eKg(500)).toBeNull();
  });
});

describe("phoneBatteryEquivalents", () => {
  it("is zero until at least one phone's worth of lithium is recovered", () => {
    expect(phoneBatteryEquivalents(1)).toBe(0);
  });

  it("reaches one at roughly four vapes", () => {
    expect(phoneBatteryEquivalents(4)).toBe(1);
  });
});

describe("formatMass", () => {
  it("renders grams below one kilogram", () => {
    expect(formatMass(0)).toBe("0 g");
    expect(formatMass(1)).toBe("1 g");
    expect(formatMass(999)).toBe("999 g");
  });

  it("switches to kilograms at exactly 1000 g", () => {
    expect(formatMass(1000)).toBe("1.0 kg");
    expect(formatMass(1001)).toBe("1.0 kg");
    expect(formatMass(1450)).toBe("1.4 kg");
  });

  it("never renders a negative or NaN mass", () => {
    expect(formatMass(-5)).toBe("0 g");
    expect(formatMass(NaN)).toBe("0 g");
  });
});
