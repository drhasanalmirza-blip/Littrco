import { describe, it, expect } from "vitest";
import {
  deviceSettingsSchema,
  DEFAULT_DEVICE_SETTINGS,
  validateDeviceSettings,
  mergeDeviceSettings,
} from "@shared/deviceSettings";

describe("deviceSettingsSchema (spec §7)", () => {
  it("accepts an empty object (all keys optional)", () => {
    expect(deviceSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the documented full shape", () => {
    const result = validateDeviceSettings({
      fill: { emptyDistanceMm: 500, fullOffsetMm: 76 },
      policy: { allowThcVapes: false, allowOtherElectronics: true },
      fire: {
        enabled: true, mode: 2,
        tempC: 40, vocAnalog: 3000, vocWarmupSec: 300,
        onBoth: ["DISPLAY", "ALARM"],
        onTempOnly: ["DISPLAY"],
        onVocOnly: ["DISPLAY"],
      },
      hours: { enabled: false, open: "09:00", close: "21:00", tz: "America/New_York" },
      ui: { theme: "default", carousel: { secPerPage: 20, postSessionCounterSec: 60 } },
      session: { stackWindowSec: 6, qrTtlSec: 30 },
      telemetry: { idleSec: 30, activeSec: 5 },
      camera: { idleSnapshotSec: 8 },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts partial documents (merge happens server-side)", () => {
    const result = validateDeviceSettings({ fill: { emptyDistanceMm: 600 } });
    expect(result.ok).toBe(true);
  });

  it("preserves unknown keys at the top level (forward-compat)", () => {
    const result = validateDeviceSettings({ futureFeature: { x: 1 }, ui: { theme: "dark" } });
    expect(result.ok && (result.value as any).futureFeature).toEqual({ x: 1 });
  });

  it("preserves unknown keys inside known sections", () => {
    const result = validateDeviceSettings({ fire: { enabled: true, newKnob: 42 } });
    expect(result.ok && (result.value.fire as any).newKnob).toBe(42);
  });

  it("rejects out-of-bounds values", () => {
    expect(validateDeviceSettings({ fire: { mode: 4 } }).ok).toBe(false);
    expect(validateDeviceSettings({ fill: { emptyDistanceMm: 10 } }).ok).toBe(false);
    expect(validateDeviceSettings({ session: { qrTtlSec: 0 } }).ok).toBe(false);
    expect(validateDeviceSettings({ telemetry: { idleSec: 100000 } }).ok).toBe(false);
  });

  it("rejects malformed HH:MM hours", () => {
    expect(validateDeviceSettings({ hours: { open: "9:00" } }).ok).toBe(false);
    expect(validateDeviceSettings({ hours: { close: "25:00" } }).ok).toBe(false);
    expect(validateDeviceSettings({ hours: { open: "09:00" } }).ok).toBe(true);
  });

  it("silently drops unknown fire actions (legacy normalization)", () => {
    // Unknown strings are filtered by normalizeFireActions rather than rejected,
    // so stored legacy docs (NOTIFY/SMS/CALL/BIN_ALARM) keep validating.
    const r = validateDeviceSettings({ fire: { onBoth: ["EXPLODE", "ALARM"] } });
    expect(r.ok && (r.value.fire as any).onBoth).toEqual(["ALARM"]);
  });

  it("maps legacy fire actions: NOTIFY→DISPLAY, BIN_ALARM→ALARM, SMS/CALL dropped", () => {
    const r = validateDeviceSettings({
      fire: { onBoth: ["NOTIFY", "BIN_ALARM", "SMS", "CALL"], onTempOnly: ["NOTIFY"] },
    });
    expect(r.ok && (r.value.fire as any).onBoth).toEqual(["DISPLAY", "ALARM"]);
    expect(r.ok && (r.value.fire as any).onTempOnly).toEqual(["DISPLAY"]);
  });

  it("rejects wrong types", () => {
    expect(validateDeviceSettings({ policy: { allowThcVapes: "yes" } }).ok).toBe(false);
    expect(validateDeviceSettings({ fill: "500" }).ok).toBe(false);
  });

  it("rejects non-object documents with a clear error", () => {
    for (const bad of [null, [], "x", 5]) {
      const result = validateDeviceSettings(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/object/i);
    }
  });

  it("reports the offending path in the error", () => {
    const result = validateDeviceSettings({ fire: { mode: 9 } });
    expect(!result.ok && result.error).toMatch(/fire\.mode/);
  });
});

describe("DEFAULT_DEVICE_SETTINGS", () => {
  it("validates against its own schema", () => {
    expect(deviceSettingsSchema.safeParse(DEFAULT_DEVICE_SETTINGS).success).toBe(true);
  });

  it("matches the documented defaults", () => {
    expect(DEFAULT_DEVICE_SETTINGS.fill).toEqual({ emptyDistanceMm: 500, fullOffsetMm: 76 });
    expect(DEFAULT_DEVICE_SETTINGS.fire?.mode).toBe(2);
    expect(DEFAULT_DEVICE_SETTINGS.fire?.enabled).toBe(true); // fire detection on by default
    expect(DEFAULT_DEVICE_SETTINGS.fire?.vocAnalog).toBe(3072); // ≈75% of ADC range
    expect(DEFAULT_DEVICE_SETTINGS.fire?.onBoth).toEqual(["DISPLAY", "ALARM"]);
    expect(DEFAULT_DEVICE_SETTINGS.session).toEqual({ stackWindowSec: 6, qrTtlSec: 30 });
    expect(DEFAULT_DEVICE_SETTINGS.camera).toEqual({ idleSnapshotSec: 8 });
    // THC vapes accepted, other electronics rejected by default (owner-confirmed)
    expect(DEFAULT_DEVICE_SETTINGS.policy).toEqual({ allowThcVapes: true, allowOtherElectronics: false });
    // Carousel pacing defaults
    expect((DEFAULT_DEVICE_SETTINGS.ui as any)?.carousel).toEqual({ secPerPage: 20, postSessionCounterSec: 60 });
  });

  it("accepts and bounds the new ui.carousel knobs", () => {
    expect(validateDeviceSettings({ ui: { carousel: { secPerPage: 5, postSessionCounterSec: 0 } } }).ok).toBe(true);
    expect(validateDeviceSettings({ ui: { carousel: { secPerPage: 120, postSessionCounterSec: 600 } } }).ok).toBe(true);
    expect(validateDeviceSettings({ ui: { carousel: { secPerPage: 4 } } }).ok).toBe(false);
    expect(validateDeviceSettings({ ui: { carousel: { secPerPage: 121 } } }).ok).toBe(false);
    expect(validateDeviceSettings({ ui: { carousel: { postSessionCounterSec: 601 } } }).ok).toBe(false);
  });

  it("accepts policy.allowOtherElectronics as a boolean", () => {
    expect(validateDeviceSettings({ policy: { allowOtherElectronics: true } }).ok).toBe(true);
    expect(validateDeviceSettings({ policy: { allowOtherElectronics: "no" } }).ok).toBe(false);
  });
});

describe("mergeDeviceSettings", () => {
  it("deep-merges nested objects key-by-key", () => {
    const base = { fill: { emptyDistanceMm: 500, fullOffsetMm: 76 }, ui: { theme: "default" } };
    const merged = mergeDeviceSettings(base, { fill: { emptyDistanceMm: 600 } });
    expect(merged).toEqual({ fill: { emptyDistanceMm: 600, fullOffsetMm: 76 }, ui: { theme: "default" } });
  });

  it("adds sections the base lacks", () => {
    const merged = mergeDeviceSettings({ ui: { theme: "default" } }, { camera: { idleSnapshotSec: 4 } });
    expect(merged).toEqual({ ui: { theme: "default" }, camera: { idleSnapshotSec: 4 } });
  });

  it("replaces arrays wholesale, never element-merges", () => {
    const base = { fire: { onBoth: ["NOTIFY", "BIN_ALARM"] } };
    const merged = mergeDeviceSettings(base, { fire: { onBoth: ["SMS"] } });
    expect((merged.fire as any).onBoth).toEqual(["SMS"]);
  });

  it("replaces scalars and null wholesale", () => {
    const base = { ui: { theme: "default" }, session: { qrTtlSec: 30 } };
    const merged = mergeDeviceSettings(base, { ui: { theme: null }, session: { qrTtlSec: 60 } });
    expect((merged.ui as any).theme).toBeNull();
    expect((merged.session as any).qrTtlSec).toBe(60);
  });

  it("skips undefined patch values (key untouched)", () => {
    const merged = mergeDeviceSettings({ ui: { theme: "default" } }, { ui: undefined });
    expect((merged.ui as any).theme).toBe("default");
  });

  it("mutates neither input", () => {
    const base = { fill: { emptyDistanceMm: 500 } };
    const patch = { fill: { fullOffsetMm: 76 } };
    mergeDeviceSettings(base, patch);
    expect(base).toEqual({ fill: { emptyDistanceMm: 500 } });
    expect(patch).toEqual({ fill: { fullOffsetMm: 76 } });
  });

  it("preserves unknown keys through a merge (forward-compat)", () => {
    const base = { futureFeature: { a: 1, b: 2 } };
    const merged = mergeDeviceSettings(base, { futureFeature: { b: 3 } });
    expect(merged.futureFeature).toEqual({ a: 1, b: 3 });
  });
});
