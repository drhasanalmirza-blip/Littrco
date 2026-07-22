// Structured device settings (spec §7). Pure module: safe to import from unit
// tests (no transitive server/db.ts import).
//
// Every key is optional — clients PUT partial documents that the server merges
// onto the stored JSON (mergeDeviceSettings). Unknown keys are preserved at
// every level (passthrough) so newer firmware settings survive older servers.

import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

// Bin-local actions on a fire/warning condition. These belong to the BIN
// (what it does on-site); who gets emailed/texted/called lives in each user's
// notification preferences, not here. DISPLAY = warning screen on the HMI,
// ALARM = sound the bin's alarm (server also enqueues SOUND_ALARM as backup).
// Legacy values from the old schema are normalized: NOTIFY→DISPLAY,
// BIN_ALARM→ALARM, SMS/CALL→dropped (moved to notification prefs).
export const fireActionSchema = z.enum(["DISPLAY", "ALARM"]);
export type FireAction = z.infer<typeof fireActionSchema>;

const LEGACY_FIRE_ACTION_MAP: Record<string, FireAction | null> = {
  DISPLAY: "DISPLAY",
  ALARM: "ALARM",
  NOTIFY: "DISPLAY",
  BIN_ALARM: "ALARM",
  SMS: null,
  CALL: null,
};

export function normalizeFireActions(raw: unknown): FireAction[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<FireAction>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const mapped = LEGACY_FIRE_ACTION_MAP[v.toUpperCase()];
    if (mapped) out.add(mapped);
  }
  return Array.from(out);
}

const fireActionsField = z.preprocess(
  (v) => (Array.isArray(v) ? normalizeFireActions(v) : v),
  z.array(fireActionSchema).max(2),
);

export const deviceSettingsSchema = z
  .object({
    fill: z
      .object({
        emptyDistanceMm: z.number().int().min(50).max(5000).optional(), // sensor→floor when empty (0%)
        fullOffsetMm: z.number().int().min(0).max(2000).optional(), // distance from lid meaning 100%
      })
      .passthrough()
      .optional(),
    policy: z
      .object({
        allowThcVapes: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    fire: z
      .object({
        enabled: z.boolean().optional(),
        mode: z.number().int().min(0).max(3).optional(), // 0 temp, 1 voc, 2 either, 3 both
        tempC: z.number().min(0).max(150).optional(),
        vocAnalog: z.number().int().min(0).max(65535).optional(),
        vocWarmupSec: z.number().int().min(0).max(3600).optional(),
        onBoth: fireActionsField.optional(),
        onTempOnly: fireActionsField.optional(),
        onVocOnly: fireActionsField.optional(),
      })
      .passthrough()
      .optional(),
    hours: z
      .object({
        enabled: z.boolean().optional(),
        open: hhmm.optional(),
        close: hhmm.optional(),
        tz: z.string().min(1).max(64).optional(), // IANA zone name
      })
      .passthrough()
      .optional(),
    ui: z
      .object({
        theme: z.string().min(1).max(40).optional(), // HMI wallpaper set
      })
      .passthrough()
      .optional(),
    session: z
      .object({
        stackWindowSec: z.number().int().min(1).max(120).optional(),
        qrTtlSec: z.number().int().min(5).max(600).optional(),
      })
      .passthrough()
      .optional(),
    telemetry: z
      .object({
        idleSec: z.number().int().min(5).max(3600).optional(),
        activeSec: z.number().int().min(1).max(600).optional(),
      })
      .passthrough()
      .optional(),
    camera: z
      .object({
        idleSnapshotSec: z.number().int().min(1).max(3600).optional(), // background reference cadence
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type DeviceSettingsJson = z.infer<typeof deviceSettingsSchema>;

export const DEFAULT_DEVICE_SETTINGS: DeviceSettingsJson = {
  fill: { emptyDistanceMm: 500, fullOffsetMm: 76 },
  policy: { allowThcVapes: true }, // THC vapes accepted by default; partners can opt out
  fire: {
    enabled: true, // always on unless explicitly disabled (partner disable notifies staff)
    mode: 2,
    tempC: 40,
    vocAnalog: 3072, // ≈75% of the 0–4095 ADC range (recommended to avoid false alarms)
    vocWarmupSec: 300,
    onBoth: ["DISPLAY", "ALARM"],
    onTempOnly: ["DISPLAY"],
    onVocOnly: ["DISPLAY"],
  },
  hours: { enabled: false, open: "09:00", close: "21:00", tz: "America/New_York" },
  ui: { theme: "default" },
  session: { stackWindowSec: 6, qrTtlSec: 30 },
  telemetry: { idleSec: 30, activeSec: 5 },
  camera: { idleSnapshotSec: 8 },
};

export type DeviceSettingsValidation =
  | { ok: true; value: DeviceSettingsJson }
  | { ok: false; error: string };

export function validateDeviceSettings(json: unknown): DeviceSettingsValidation {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, error: "Settings must be a JSON object" };
  }
  const parsed = deviceSettingsSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");
    return { ok: false, error: path ? `${path}: ${issue.message}` : issue.message };
  }
  return { ok: true, value: parsed.data };
}

// VOC threshold is stored as the sensor's raw ADC value (0–4095) because the
// firmware compares raw readings; UIs present it as a 0–100% slider.
// Recommended setting: 75% — high enough to avoid false alarms from vaping/smoke.
export const VOC_ANALOG_MAX = 4095;
export const VOC_RECOMMENDED_PCT = 75;

export function vocPctFromAnalog(analog: number): number {
  return Math.round(Math.min(Math.max(analog / VOC_ANALOG_MAX, 0), 1) * 100);
}

export function vocAnalogFromPct(pct: number): number {
  return Math.round(Math.min(Math.max(pct, 0), 100) / 100 * VOC_ANALOG_MAX);
}

export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) * 5 / 9;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge a partial settings patch onto stored settings. Plain objects merge
 * recursively; arrays, scalars, and null replace wholesale; undefined patch
 * values are skipped (key untouched). Neither input is mutated.
 */
export function mergeDeviceSettings<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(value)
      ? mergeDeviceSettings(prev, value)
      : value;
  }
  return out as T;
}
