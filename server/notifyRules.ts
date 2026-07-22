// Pure decision logic for the alert & notification engine (spec §5).
//
// NO db/schema imports — this module must stay importable from unit tests
// (server/db.ts throws without DATABASE_URL). All I/O lives in server/notify.ts;
// everything here is deterministic data-in/data-out.

import { z } from "zod";

// ==================== Alert types & severities (spec §5.2) ====================

export type AlertType =
  | "FILL_THRESHOLD"
  | "FULL"
  | "TEMP_HIGH"
  | "VOC_HIGH"
  | "FIRE"
  | "OFFLINE"
  | "SD_ERROR"
  | "CAMERA_ERROR";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

// §5.2 per-type table. (§2.2's blanket "FIRE ⇒ CRITICAL, others WARNING" is
// superseded by this closed set, which marks SD/CAMERA errors INFO.)
export const ALERT_SEVERITY: Record<AlertType, AlertSeverity> = {
  FILL_THRESHOLD: "WARNING",
  FULL: "CRITICAL",
  TEMP_HIGH: "WARNING",
  VOC_HIGH: "WARNING",
  FIRE: "CRITICAL",
  OFFLINE: "WARNING",
  SD_ERROR: "INFO",
  CAMERA_ERROR: "INFO",
};

export const DEVICE_EVENT_TYPES = ["FIRE", "TEMP_HIGH", "VOC_HIGH", "SD_ERROR", "CAMERA_ERROR"] as const;
export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

// ==================== Timing constants ====================

export const OFFLINE_AFTER_MS = 10 * 60 * 1000; // silent this long ⇒ OFFLINE (§5.1)
export const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // offline sweep cadence (§5.1)
export const EVENT_DEDUPE_WINDOW_MS = 10 * 60 * 1000; // unresolved-alert refresh window (§2.2)

// ==================== Fill hysteresis (spec §5.4) ====================

export const FULL_TRIGGER_AT = 100; // fillPercent that raises FULL
export const FULL_REARM_BELOW = 90; // FULL re-arms when fill drops under this
export const FILL_REARM_DROP = 10; // a level re-arms when fill drops ≥10 under it

export interface AlertState {
  notifiedFillLevels: number[];
  fullNotified: boolean;
}

export function normalizeAlertState(raw: unknown): AlertState {
  const state: AlertState = { notifiedFillLevels: [], fullNotified: false };
  if (isRecord(raw)) {
    if (Array.isArray(raw.notifiedFillLevels)) {
      state.notifiedFillLevels = raw.notifiedFillLevels.filter(
        (n): n is number => typeof n === "number" && Number.isFinite(n),
      );
    }
    if (typeof raw.fullNotified === "boolean") state.fullNotified = raw.fullNotified;
  }
  return state;
}

export interface FillEvaluation {
  state: AlertState;
  /** State differs from the input (re-arm and/or new notifications) — persist it. */
  changed: boolean;
  /** Levels crossed upward this evaluation — one FILL_THRESHOLD alert each. */
  crossedLevels: number[];
  /** FULL crossed this evaluation — one FULL alert. */
  fullTriggered: boolean;
}

/**
 * Threshold evaluation with hysteresis. A level notifies once when fill reaches
 * it and re-arms only after fill drops ≥FILL_REARM_DROP points below it; FULL
 * fires at FULL_TRIGGER_AT and re-arms below FULL_REARM_BELOW. Clearing the
 * stored state (mark-empty / RESET_FILL_AND_COUNT) re-arms everything.
 */
export function evaluateFillAlerts(
  prev: AlertState,
  fillPercent: number,
  watchedLevels: number[],
): FillEvaluation {
  // Re-arm levels the fill has dropped far enough below
  const armedOut = prev.notifiedFillLevels.filter((level) => fillPercent > level - FILL_REARM_DROP);
  let fullNotified = prev.fullNotified && fillPercent >= FULL_REARM_BELOW;

  const crossedLevels: number[] = [];
  for (const level of Array.from(new Set(watchedLevels)).sort((a, b) => a - b)) {
    if (fillPercent >= level && !armedOut.includes(level)) {
      armedOut.push(level);
      crossedLevels.push(level);
    }
  }

  let fullTriggered = false;
  if (fillPercent >= FULL_TRIGGER_AT && !fullNotified) {
    fullNotified = true;
    fullTriggered = true;
  }

  const state: AlertState = { notifiedFillLevels: armedOut, fullNotified };
  const changed =
    state.fullNotified !== prev.fullNotified ||
    state.notifiedFillLevels.length !== prev.notifiedFillLevels.length ||
    state.notifiedFillLevels.some((l, i) => l !== prev.notifiedFillLevels[i]);
  return { state, changed, crossedLevels, fullTriggered };
}

// ==================== Preferences (spec §5.3) ====================

export type Channel = "email" | "sms" | "call" | "push";
export const CHANNELS: Channel[] = ["email", "sms", "call", "push"];

export interface ChannelPrefs {
  email: boolean;
  sms: boolean;
  call: boolean;
  push: boolean;
}

export interface EventPrefs {
  full: boolean;
  fillLevels: number[];
  fire: boolean;
  tempHigh: boolean;
  vocHigh: boolean;
  offline: boolean;
  drops: boolean;
}

export const DEFAULT_CHANNELS: ChannelPrefs = { email: true, sms: false, call: false, push: false };

// FULL and FIRE are pre-enabled for everyone (product requirement, §5.3)
export const DEFAULT_EVENTS: EventPrefs = {
  full: true,
  fillLevels: [],
  fire: true,
  tempHigh: true,
  vocHigh: true,
  offline: true,
  drops: false,
};

/** Merge a stored channelsJson value (possibly missing/partial/junk) onto defaults. */
export function mergeChannelPrefs(stored: unknown): ChannelPrefs {
  const out = { ...DEFAULT_CHANNELS };
  if (isRecord(stored)) {
    for (const c of CHANNELS) {
      if (typeof stored[c] === "boolean") out[c] = stored[c] as boolean;
    }
  }
  return out;
}

/** Merge a stored eventsJson value (possibly missing/partial/junk) onto defaults. */
export function mergeEventPrefs(stored: unknown): EventPrefs {
  const out: EventPrefs = { ...DEFAULT_EVENTS, fillLevels: [...DEFAULT_EVENTS.fillLevels] };
  if (isRecord(stored)) {
    for (const k of ["full", "fire", "tempHigh", "vocHigh", "offline", "drops"] as const) {
      if (typeof stored[k] === "boolean") out[k] = stored[k] as boolean;
    }
    if (Array.isArray(stored.fillLevels)) {
      out.fillLevels = stored.fillLevels.filter(
        (n): n is number => typeof n === "number" && Number.isFinite(n),
      );
    }
  }
  return out;
}

// Prefs PUT validation (spec §3.3/§4.1) — partial patches, unknown keys rejected
export const channelPrefsPatchSchema = z
  .object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    call: z.boolean().optional(),
    push: z.boolean().optional(),
  })
  .strict();

export const eventPrefsPatchSchema = z
  .object({
    full: z.boolean().optional(),
    fillLevels: z.array(z.number().int().min(1).max(100)).max(10).optional(),
    fire: z.boolean().optional(),
    tempHigh: z.boolean().optional(),
    vocHigh: z.boolean().optional(),
    offline: z.boolean().optional(),
    drops: z.boolean().optional(),
  })
  .strict();

export const notificationPrefsPutSchema = z
  .object({
    channelsJson: channelPrefsPatchSchema.optional(),
    eventsJson: eventPrefsPatchSchema.optional(),
    phone: z.string().min(3).max(32).nullable().optional(),
  })
  .strict();

export type NotificationPrefsPut = z.infer<typeof notificationPrefsPutSchema>;

export function applyChannelPrefsPatch(
  base: ChannelPrefs,
  patch: Partial<ChannelPrefs> | undefined,
): ChannelPrefs {
  return { ...base, ...(patch ?? {}) };
}

export function applyEventPrefsPatch(
  base: EventPrefs,
  patch: Partial<EventPrefs> | undefined,
): EventPrefs {
  const out = { ...base, ...(patch ?? {}) };
  // fillLevels replaces wholesale when provided
  out.fillLevels = patch?.fillLevels !== undefined ? [...patch.fillLevels] : [...base.fillLevels];
  return out;
}

// ==================== Recipient filtering (spec §5.5) ====================

/**
 * Does this recipient's eventsJson opt them into the given alert?
 * FILL_THRESHOLD matches only when their own fillLevels include the crossed
 * level. SD/CAMERA errors have no pref toggle — always delivered (device
 * health, INFO severity).
 */
export function alertMatchesPrefs(
  type: AlertType,
  data: { level?: number } | null | undefined,
  events: EventPrefs,
): boolean {
  switch (type) {
    case "FULL":
      return events.full;
    case "FIRE":
      return events.fire;
    case "TEMP_HIGH":
      return events.tempHigh;
    case "VOC_HIGH":
      return events.vocHigh;
    case "OFFLINE":
      return events.offline;
    case "FILL_THRESHOLD":
      return typeof data?.level === "number" && events.fillLevels.includes(data.level);
    case "SD_ERROR":
    case "CAMERA_ERROR":
      return true;
  }
}

export function enabledChannels(channels: ChannelPrefs): Channel[] {
  return CHANNELS.filter((c) => channels[c]);
}

/** Union of every recipient's fillLevels — the set the engine watches for a device. */
export function watchedFillLevels(allEvents: EventPrefs[]): number[] {
  const set = new Set<number>();
  for (const e of allEvents) for (const l of e.fillLevels) set.add(l);
  return Array.from(set).sort((a, b) => a - b);
}

// ==================== Offline detection (spec §5.1.3) ====================

export function isSilentTooLong(lastHeartbeatAt: Date | null, now: Date): boolean {
  if (!lastHeartbeatAt) return false; // never heartbeated ⇒ not "went offline"
  return now.getTime() - lastHeartbeatAt.getTime() > OFFLINE_AFTER_MS;
}

// ==================== Device-event dedupe (spec §2.2) ====================

export function withinDedupeWindow(alertCreatedAt: Date, now: Date): boolean {
  return now.getTime() - alertCreatedAt.getTime() < EVENT_DEDUPE_WINDOW_MS;
}

// ==================== Fire actions (spec §7) ====================

export type FireAction = "NOTIFY" | "SMS" | "CALL" | "BIN_ALARM";

export interface FireRuleSettings {
  tempC?: number;
  vocAnalog?: number;
  onBoth?: FireAction[];
  onTempOnly?: FireAction[];
  onVocOnly?: FireAction[];
}

const FIRE_DEFAULTS: Required<Pick<FireRuleSettings, "tempC" | "vocAnalog" | "onBoth" | "onTempOnly" | "onVocOnly">> = {
  tempC: 40,
  vocAnalog: 3000,
  onBoth: ["NOTIFY", "BIN_ALARM"],
  onTempOnly: ["NOTIFY"],
  onVocOnly: ["NOTIFY"],
};

/**
 * Which configured action list applies to a FIRE event, classified from the
 * readings the device sent against the configured thresholds. The device owns
 * fire detection; when readings are missing or below both thresholds we cannot
 * classify, so we take the strongest set (onBoth) — fire was declared.
 */
export function fireActionsForEvent(
  fire: FireRuleSettings | undefined,
  evt: { tempC?: number | null; vocAnalog?: number | null },
): FireAction[] {
  const cfg = { ...FIRE_DEFAULTS, ...(fire ?? {}) };
  const tempTrig = evt.tempC != null && evt.tempC >= cfg.tempC;
  const vocTrig = evt.vocAnalog != null && evt.vocAnalog >= cfg.vocAnalog;
  const list =
    tempTrig && vocTrig ? cfg.onBoth
    : tempTrig ? cfg.onTempOnly
    : vocTrig ? cfg.onVocOnly
    : cfg.onBoth;
  return Array.from(new Set(list));
}

// ==================== Default alert messages ====================

export function alertMessage(
  type: AlertType,
  data: { level?: number; fillPercent?: number; tempC?: number; vocAnalog?: number; lastHeartbeatAt?: string },
): string {
  switch (type) {
    case "FILL_THRESHOLD":
      return `Fill level reached ${data.level}% (now ${data.fillPercent ?? data.level}%)`;
    case "FULL":
      return `Bin is full (${data.fillPercent ?? FULL_TRIGGER_AT}%)`;
    case "FIRE":
      return `FIRE detected${data.tempC != null ? ` — ${data.tempC}°C` : ""}${data.vocAnalog != null ? `, VOC ${data.vocAnalog}` : ""}`;
    case "TEMP_HIGH":
      return `High temperature${data.tempC != null ? `: ${data.tempC}°C` : ""}`;
    case "VOC_HIGH":
      return `High VOC reading${data.vocAnalog != null ? `: ${data.vocAnalog}` : ""}`;
    case "OFFLINE":
      return `Bin offline — no heartbeat since ${data.lastHeartbeatAt ?? "unknown"}`;
    case "SD_ERROR":
      return "SD card error reported by device";
    case "CAMERA_ERROR":
      return "Camera error reported by device";
  }
}

// ==================== helpers ====================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
