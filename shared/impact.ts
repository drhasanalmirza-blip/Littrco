// Environmental-impact estimates shown on the customer dashboard.
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ TODO(owner): VERIFY EVERY CONSTANT BELOW AGAINST A PRIMARY SOURCE BEFORE  │
// │ THESE NUMBERS APPEAR IN ANY PUBLIC OR MARKETING CONTEXT.                  │
// │                                                                           │
// │ The values here are derived from widely-reported secondary coverage, not  │
// │ from a primary measurement or a commissioned LCA. They are deliberately   │
// │ conservative and every helper rounds DOWN, so the bin under-claims rather │
// │ than over-claims — but "conservative" is not "verified". Environmental    │
// │ claims are regulated in several jurisdictions (e.g. UK CMA Green Claims   │
// │ Code, US FTC Green Guides) and an unsourced number is a real liability.   │
// └───────────────────────────────────────────────────────────────────────────┘
//
// Pure module: no imports, no I/O. Runs identically in the browser bundle and
// under `npm test` (vitest, node env) via the @shared alias.

export const IMPACT_FACTORS = {
  /**
   * Grams of lithium in a typical single-use vape cell.
   *
   * @value 0.15
   * @source Derived from Material Focus (UK) disposable-vape research, 2022:
   *   ~1.3 million disposable vapes discarded per week, containing roughly
   *   10 tonnes of lithium per year in aggregate.
   *   10,000,000 g ÷ (1.3e6 × 52) ≈ 0.148 g per device.
   * @retrieved Reported figure, not read from the primary publication in this
   *   session. VERIFY against the original Material Focus report before use.
   * @assumption Treats every device as an average single-use vape. Real cells
   *   range roughly 250–850 mAh; larger "big puff" devices contain more, so
   *   this under-counts for those.
   */
  LITHIUM_G_PER_VAPE: 0.15,

  /**
   * Total device mass diverted from landfill per vape, in grams.
   *
   * @value 25
   * @source Typical disposable-vape all-in mass (battery + tank + housing) is
   *   commonly quoted in the 25–35 g range. We take the BOTTOM of that range.
   * @retrieved Secondary/industry-typical figure — not measured. VERIFY.
   * @assumption Whole-device mass, not just the recoverable fraction. If you
   *   want to claim "materials recovered" rather than "diverted from landfill",
   *   this needs to become a smaller, recycler-confirmed number.
   */
  DEVICE_MASS_G_PER_VAPE: 25,

  /**
   * kg CO₂e avoided per vape recycled.
   *
   * DELIBERATELY null — see the note below. Leave it null until a defensible
   * life-cycle assessment exists.
   */
  CO2E_KG_PER_VAPE: null as number | null,
} as const;

/**
 * Why CO₂ ships disabled:
 *
 * There is no consensus per-device life-cycle assessment for a disposable vape,
 * and "avoided emissions" is the single easiest environmental claim to attack
 * as greenwashing. Publishing a number we cannot defend is a bigger risk than
 * omitting a tile. `co2eKg()` returns null while the factor is null and the UI
 * renders that tile only when it is non-null, so enabling this later is a
 * one-constant change — with the unit test already in place as a tripwire.
 */

export const IMPACT_DISCLAIMER =
  "Estimates based on published industry averages. Actual materials recovered vary by device.";

/** Coerce anything to a safe, non-negative count. */
function safeCount(vapes: number): number {
  if (!Number.isFinite(vapes) || vapes <= 0) return 0;
  return Math.floor(vapes);
}

/** Grams of lithium recovered for `vapes` devices. Rounds down (under-claims). */
export function lithiumGrams(vapes: number): number {
  const n = safeCount(vapes);
  // One decimal place: 0.15 g/device is too small to show as a whole number.
  return Math.floor(n * IMPACT_FACTORS.LITHIUM_G_PER_VAPE * 10) / 10;
}

/** Grams of e-waste diverted from landfill for `vapes` devices. Rounds down. */
export function ewasteGrams(vapes: number): number {
  return safeCount(vapes) * IMPACT_FACTORS.DEVICE_MASS_G_PER_VAPE;
}

/**
 * kg CO₂e avoided, or null when no defensible factor is configured.
 * Callers MUST handle null by hiding the metric — never by showing 0.
 */
export function co2eKg(vapes: number): number | null {
  const factor = IMPACT_FACTORS.CO2E_KG_PER_VAPE;
  if (factor == null) return null;
  return Math.floor(safeCount(vapes) * factor * 100) / 100;
}

/**
 * Lithium expressed in a unit people can picture.
 *
 * @assumption ~0.6 g of lithium in a typical smartphone battery, so roughly
 *   four vapes' worth of lithium per phone. Same verification caveat as above.
 */
const LITHIUM_G_PER_PHONE_BATTERY = 0.6;

export function phoneBatteryEquivalents(vapes: number): number {
  return Math.floor(lithiumGrams(vapes) / LITHIUM_G_PER_PHONE_BATTERY);
}

/**
 * Human-readable mass. Grams below 1 kg, kilograms above, one decimal.
 * Pure so the display string itself is unit-tested.
 */
export function formatMass(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return "0 g";
  if (grams < 1000) return `${Math.floor(grams)} g`;
  return `${(Math.floor(grams / 100) / 10).toFixed(1)} kg`;
}
