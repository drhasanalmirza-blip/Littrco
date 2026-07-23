import { describe, it, expect } from "vitest";
import {
  ALERT_SEVERITY,
  DEFAULT_CHANNELS,
  DEFAULT_EVENTS,
  EVENT_DEDUPE_WINDOW_MS,
  OFFLINE_AFTER_MS,
  SWEEP_INTERVAL_MS,
  normalizeAlertState,
  evaluateFillAlerts,
  mergeChannelPrefs,
  mergeEventPrefs,
  applyChannelPrefsPatch,
  applyEventPrefsPatch,
  notificationPrefsPutSchema,
  alertMatchesPrefs,
  enabledChannels,
  watchedFillLevels,
  isSilentTooLong,
  withinDedupeWindow,
  fireActionsForEvent,
  alertMessage,
  planPhoneDispatch,
  passesPersonalThresholds,
  mergePhoneEntries,
  normalizePhoneNumber,
  type AlertState,
  type EventPrefs,
} from "../notifyRules";

describe("ALERT_SEVERITY (spec §5.2)", () => {
  it("matches the closed set", () => {
    expect(ALERT_SEVERITY).toEqual({
      FILL_THRESHOLD: "WARNING",
      FULL: "CRITICAL",
      TEMP_HIGH: "WARNING",
      VOC_HIGH: "WARNING",
      FIRE: "CRITICAL",
      FIRE_DISABLED: "WARNING",
      OFFLINE: "WARNING",
      SD_ERROR: "INFO",
      CAMERA_ERROR: "INFO",
      UPDATE_FAILED: "WARNING",
    });
  });
});

describe("timing constants", () => {
  it("offline after 10 min, sweep every 5 min, dedupe window 10 min", () => {
    expect(OFFLINE_AFTER_MS).toBe(10 * 60 * 1000);
    expect(SWEEP_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(EVENT_DEDUPE_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

describe("normalizeAlertState", () => {
  it("null/undefined/junk -> empty state", () => {
    for (const raw of [null, undefined, "x", 5, [], { notifiedFillLevels: "80" }]) {
      expect(normalizeAlertState(raw)).toEqual({ notifiedFillLevels: [], fullNotified: false });
    }
  });

  it("keeps valid fields and drops non-numeric levels", () => {
    const s = normalizeAlertState({ notifiedFillLevels: [80, "90", null, 95, NaN], fullNotified: true });
    expect(s).toEqual({ notifiedFillLevels: [80, 95], fullNotified: true });
  });
});

describe("evaluateFillAlerts (spec §5.4 hysteresis)", () => {
  const empty: AlertState = { notifiedFillLevels: [], fullNotified: false };

  it("notifies once when a level is crossed upward", () => {
    const r = evaluateFillAlerts(empty, 82, [80]);
    expect(r.crossedLevels).toEqual([80]);
    expect(r.state.notifiedFillLevels).toEqual([80]);
    expect(r.changed).toBe(true);
  });

  it("does not repeat while fill stays above the level", () => {
    const r1 = evaluateFillAlerts(empty, 82, [80]);
    const r2 = evaluateFillAlerts(r1.state, 85, [80]);
    expect(r2.crossedLevels).toEqual([]);
    expect(r2.changed).toBe(false);
  });

  it("triggers exactly at the level boundary", () => {
    expect(evaluateFillAlerts(empty, 80, [80]).crossedLevels).toEqual([80]);
    expect(evaluateFillAlerts(empty, 79, [80]).crossedLevels).toEqual([]);
  });

  it("re-arms when fill drops >= 10 points below the level", () => {
    const notified: AlertState = { notifiedFillLevels: [80], fullNotified: false };
    // 70 = 80-10 -> re-armed (removed from state)
    const r = evaluateFillAlerts(notified, 70, [80]);
    expect(r.state.notifiedFillLevels).toEqual([]);
    expect(r.crossedLevels).toEqual([]);
    expect(r.changed).toBe(true);
    // then crossing back up notifies again
    const r2 = evaluateFillAlerts(r.state, 81, [80]);
    expect(r2.crossedLevels).toEqual([80]);
  });

  it("does NOT re-arm at only 9 points below", () => {
    const notified: AlertState = { notifiedFillLevels: [80], fullNotified: false };
    const r = evaluateFillAlerts(notified, 71, [80]);
    expect(r.state.notifiedFillLevels).toEqual([80]);
    expect(r.changed).toBe(false);
  });

  it("crosses multiple levels in one jump, ascending, deduped", () => {
    const r = evaluateFillAlerts(empty, 95, [90, 80, 80]);
    expect(r.crossedLevels).toEqual([80, 90]);
    expect(r.state.notifiedFillLevels).toEqual([80, 90]);
  });

  it("ignores unwatched levels lingering in state", () => {
    const r = evaluateFillAlerts(empty, 85, [80]);
    const r2 = evaluateFillAlerts(r.state, 86, []); // user removed the level
    expect(r2.crossedLevels).toEqual([]);
  });

  it("FULL triggers at 100 once", () => {
    const r = evaluateFillAlerts(empty, 100, []);
    expect(r.fullTriggered).toBe(true);
    expect(r.state.fullNotified).toBe(true);
    const r2 = evaluateFillAlerts(r.state, 100, []);
    expect(r2.fullTriggered).toBe(false);
  });

  it("FULL does not trigger below 100", () => {
    expect(evaluateFillAlerts(empty, 99, []).fullTriggered).toBe(false);
  });

  it("FULL re-arms below 90, not at 90", () => {
    const notified: AlertState = { notifiedFillLevels: [], fullNotified: true };
    expect(evaluateFillAlerts(notified, 90, []).state.fullNotified).toBe(true);
    const r = evaluateFillAlerts(notified, 89, []);
    expect(r.state.fullNotified).toBe(false);
    expect(r.changed).toBe(true);
    // re-armed -> next 100 fires again
    expect(evaluateFillAlerts(r.state, 100, []).fullTriggered).toBe(true);
  });

  it("cleared state (mark-empty / RESET_FILL_AND_COUNT) re-arms everything", () => {
    const cleared = normalizeAlertState(null);
    const r = evaluateFillAlerts(cleared, 100, [80]);
    expect(r.crossedLevels).toEqual([80]);
    expect(r.fullTriggered).toBe(true);
  });

  it("does not mutate the input state", () => {
    const prev: AlertState = { notifiedFillLevels: [80], fullNotified: true };
    evaluateFillAlerts(prev, 50, [80]);
    expect(prev).toEqual({ notifiedFillLevels: [80], fullNotified: true });
  });
});

describe("prefs defaults & merge (spec §5.3)", () => {
  it("defaults: email-only channels; FULL and FIRE pre-enabled", () => {
    expect(DEFAULT_CHANNELS).toEqual({ email: true, sms: false, call: false, push: false });
    expect(DEFAULT_EVENTS).toEqual({
      full: true, fillLevels: [], fire: true, tempHigh: true, vocHigh: true, offline: true, drops: false,
      tempThresholdC: null, vocThresholdPct: null,
    });
  });

  it("mergeChannelPrefs fills gaps and ignores junk", () => {
    expect(mergeChannelPrefs(undefined)).toEqual(DEFAULT_CHANNELS);
    expect(mergeChannelPrefs({ sms: true })).toEqual({ email: true, sms: true, call: false, push: false });
    expect(mergeChannelPrefs({ email: "no", junk: 1 })).toEqual(DEFAULT_CHANNELS);
    expect(mergeChannelPrefs("garbage")).toEqual(DEFAULT_CHANNELS);
  });

  it("mergeEventPrefs fills gaps, keeps valid fillLevels, drops junk entries", () => {
    expect(mergeEventPrefs(null)).toEqual(DEFAULT_EVENTS);
    const m = mergeEventPrefs({ full: false, fillLevels: [80, "90", NaN, 95] });
    expect(m.full).toBe(false);
    expect(m.fire).toBe(true); // untouched default
    expect(m.fillLevels).toEqual([80, 95]);
  });

  it("merge does not share the default fillLevels array", () => {
    const a = mergeEventPrefs(null);
    a.fillLevels.push(80);
    expect(DEFAULT_EVENTS.fillLevels).toEqual([]);
    expect(mergeEventPrefs(null).fillLevels).toEqual([]);
  });

  it("applyChannelPrefsPatch overrides only given keys", () => {
    const out = applyChannelPrefsPatch(DEFAULT_CHANNELS, { push: true });
    expect(out).toEqual({ email: true, sms: false, call: false, push: true });
  });

  it("applyEventPrefsPatch replaces fillLevels wholesale and copies arrays", () => {
    const base: EventPrefs = { ...DEFAULT_EVENTS, fillLevels: [70] };
    const patchLevels = [80, 90];
    const out = applyEventPrefsPatch(base, { fillLevels: patchLevels, drops: true });
    expect(out.fillLevels).toEqual([80, 90]);
    expect(out.drops).toBe(true);
    out.fillLevels.push(99);
    expect(patchLevels).toEqual([80, 90]);
    const untouched = applyEventPrefsPatch(base, { drops: true });
    expect(untouched.fillLevels).toEqual([70]);
  });
});

describe("notificationPrefsPutSchema (spec §3.3 PUT body)", () => {
  it("accepts partial bodies", () => {
    expect(notificationPrefsPutSchema.safeParse({}).success).toBe(true);
    expect(notificationPrefsPutSchema.safeParse({ eventsJson: { fillLevels: [80] } }).success).toBe(true);
    expect(notificationPrefsPutSchema.safeParse({ channelsJson: { sms: true }, phone: "+16073850725" }).success).toBe(true);
    expect(notificationPrefsPutSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("rejects unknown keys and bad values", () => {
    expect(notificationPrefsPutSchema.safeParse({ bogus: 1 }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ channelsJson: { fax: true } }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ eventsJson: { full: "yes" } }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ eventsJson: { fillLevels: [0] } }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ eventsJson: { fillLevels: [101] } }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ eventsJson: { fillLevels: [80.5] } }).success).toBe(false);
    expect(notificationPrefsPutSchema.safeParse({ phone: "1" }).success).toBe(false);
  });
});

describe("alertMatchesPrefs (spec §5.5 recipient filtering)", () => {
  const events: EventPrefs = {
    full: true, fillLevels: [80], fire: false, tempHigh: true, vocHigh: false, offline: true, drops: false,
  };

  it("maps each type to its pref", () => {
    expect(alertMatchesPrefs("FULL", null, events)).toBe(true);
    expect(alertMatchesPrefs("FIRE", null, events)).toBe(false);
    expect(alertMatchesPrefs("TEMP_HIGH", null, events)).toBe(true);
    expect(alertMatchesPrefs("VOC_HIGH", null, events)).toBe(false);
    expect(alertMatchesPrefs("OFFLINE", null, events)).toBe(true);
  });

  it("FILL_THRESHOLD matches only the recipient's own levels", () => {
    expect(alertMatchesPrefs("FILL_THRESHOLD", { level: 80 }, events)).toBe(true);
    expect(alertMatchesPrefs("FILL_THRESHOLD", { level: 90 }, events)).toBe(false);
    expect(alertMatchesPrefs("FILL_THRESHOLD", null, events)).toBe(false);
    expect(alertMatchesPrefs("FILL_THRESHOLD", {}, events)).toBe(false);
  });

  it("SD/CAMERA errors have no toggle and always deliver", () => {
    const allOff: EventPrefs = { full: false, fillLevels: [], fire: false, tempHigh: false, vocHigh: false, offline: false, drops: false };
    expect(alertMatchesPrefs("SD_ERROR", null, allOff)).toBe(true);
    expect(alertMatchesPrefs("CAMERA_ERROR", null, allOff)).toBe(true);
  });
});

describe("enabledChannels / watchedFillLevels", () => {
  it("returns only enabled channels", () => {
    expect(enabledChannels({ email: true, sms: false, call: true, push: false })).toEqual(["email", "call"]);
    expect(enabledChannels({ email: false, sms: false, call: false, push: false })).toEqual([]);
  });

  it("unions and sorts fill levels across recipients", () => {
    const a: EventPrefs = { ...DEFAULT_EVENTS, fillLevels: [90, 80] };
    const b: EventPrefs = { ...DEFAULT_EVENTS, fillLevels: [80, 50] };
    expect(watchedFillLevels([a, b, DEFAULT_EVENTS])).toEqual([50, 80, 90]);
    expect(watchedFillLevels([])).toEqual([]);
  });
});

describe("isSilentTooLong (spec §5.1.3)", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("true when last heartbeat older than 10 min", () => {
    expect(isSilentTooLong(new Date(now.getTime() - 11 * 60 * 1000), now)).toBe(true);
  });

  it("false at exactly 10 min or newer", () => {
    expect(isSilentTooLong(new Date(now.getTime() - 10 * 60 * 1000), now)).toBe(false);
    expect(isSilentTooLong(new Date(now.getTime() - 60 * 1000), now)).toBe(false);
  });

  it("false when the device never heartbeated", () => {
    expect(isSilentTooLong(null, now)).toBe(false);
  });
});

describe("withinDedupeWindow (spec §2.2)", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("true inside 10 minutes, false at/after", () => {
    expect(withinDedupeWindow(new Date(now.getTime() - 9 * 60 * 1000), now)).toBe(true);
    expect(withinDedupeWindow(new Date(now.getTime() - 10 * 60 * 1000), now)).toBe(false);
    expect(withinDedupeWindow(new Date(now.getTime() - 11 * 60 * 1000), now)).toBe(false);
  });
});

describe("fireActionsForEvent (bin-local DISPLAY/ALARM)", () => {
  const fire = {
    tempC: 40,
    vocAnalog: 3000,
    onBoth: ["DISPLAY", "ALARM"] as const,
    onTempOnly: ["DISPLAY"] as const,
    onVocOnly: ["ALARM"] as const,
  };

  it("both thresholds hit -> onBoth", () => {
    expect(fireActionsForEvent(fire as any, { tempC: 45, vocAnalog: 3500 })).toEqual(["DISPLAY", "ALARM"]);
  });

  it("temp only -> onTempOnly", () => {
    expect(fireActionsForEvent(fire as any, { tempC: 45, vocAnalog: 100 })).toEqual(["DISPLAY"]);
    expect(fireActionsForEvent(fire as any, { tempC: 45 })).toEqual(["DISPLAY"]);
  });

  it("voc only -> onVocOnly", () => {
    expect(fireActionsForEvent(fire as any, { tempC: 20, vocAnalog: 3000 })).toEqual(["ALARM"]);
  });

  it("unclassifiable (no readings) -> strongest set (onBoth)", () => {
    expect(fireActionsForEvent(fire as any, {})).toEqual(["DISPLAY", "ALARM"]);
    expect(fireActionsForEvent(fire as any, { tempC: 20, vocAnalog: 100 })).toEqual(["DISPLAY", "ALARM"]);
  });

  it("missing settings fall back to defaults", () => {
    expect(fireActionsForEvent(undefined, { tempC: 45, vocAnalog: 3500 })).toEqual(["DISPLAY", "ALARM"]);
    expect(fireActionsForEvent({}, { tempC: 45 })).toEqual(["DISPLAY"]);
  });

  it("dedupes repeated actions", () => {
    expect(fireActionsForEvent({ onBoth: ["DISPLAY", "DISPLAY", "ALARM"] } as any, {})).toEqual(["DISPLAY", "ALARM"]);
  });
});

describe("planPhoneDispatch (multi-number dedupe)", () => {
  const owner = {
    userId: "owner",
    phones: [{ number: "+1 (607) 385-0725", sms: true, call: true, minSeverity: "WARNING" as const }],
  };
  const manager = {
    userId: "manager",
    phones: [{ number: "16073850725", sms: true, call: false, minSeverity: "WARNING" as const }],
  };

  it("unions channels for the same number across accounts (no duplicate sends)", () => {
    // +1(607)... and 1607... normalize differently (+1607 vs 1607) — use same form
    const a = { userId: "a", phones: [{ number: "607-385-0725", sms: true, call: false, minSeverity: "WARNING" as const }] };
    const b = { userId: "b", phones: [{ number: "(607) 385 0725", sms: true, call: true, minSeverity: "WARNING" as const }] };
    const plan = planPhoneDispatch([a, b], "WARNING");
    expect(plan).toHaveLength(1);
    expect(plan[0].sms).toBe(true);
    expect(plan[0].call).toBe(true);
    expect(plan[0].userIds.sort()).toEqual(["a", "b"]);
  });

  it("keeps distinct numbers separate", () => {
    const plan = planPhoneDispatch([owner, manager], "CRITICAL");
    expect(plan).toHaveLength(2);
  });

  it("respects per-number minimum severity", () => {
    const critOnly = {
      userId: "u",
      phones: [{ number: "5551234567", sms: true, call: false, minSeverity: "CRITICAL" as const }],
    };
    expect(planPhoneDispatch([critOnly], "WARNING")).toHaveLength(0);
    expect(planPhoneDispatch([critOnly], "CRITICAL")).toHaveLength(1);
  });

  it("skips entries with no channel enabled", () => {
    const none = {
      userId: "u",
      phones: [{ number: "5551234567", sms: false, call: false, minSeverity: "INFO" as const }],
    };
    expect(planPhoneDispatch([none], "CRITICAL")).toHaveLength(0);
  });
});

describe("passesPersonalThresholds", () => {
  const base = { ...DEFAULT_EVENTS };

  it("no threshold set -> always delivers", () => {
    expect(passesPersonalThresholds("TEMP_HIGH", { tempC: 30 }, base, 4095)).toBe(true);
    expect(passesPersonalThresholds("VOC_HIGH", { vocAnalog: 100 }, base, 4095)).toBe(true);
  });

  it("temp threshold gates below, passes at/above", () => {
    const ev = { ...base, tempThresholdC: 50 };
    expect(passesPersonalThresholds("TEMP_HIGH", { tempC: 45 }, ev, 4095)).toBe(false);
    expect(passesPersonalThresholds("TEMP_HIGH", { tempC: 50 }, ev, 4095)).toBe(true);
  });

  it("voc threshold compares as percent of ADC max", () => {
    const ev = { ...base, vocThresholdPct: 75 };
    expect(passesPersonalThresholds("VOC_HIGH", { vocAnalog: 2000 }, ev, 4095)).toBe(false); // ~49%
    expect(passesPersonalThresholds("VOC_HIGH", { vocAnalog: 3100 }, ev, 4095)).toBe(true); // ~76%
  });

  it("missing reading -> delivers (cannot compare)", () => {
    const ev = { ...base, tempThresholdC: 50, vocThresholdPct: 75 };
    expect(passesPersonalThresholds("TEMP_HIGH", {}, ev, 4095)).toBe(true);
    expect(passesPersonalThresholds("VOC_HIGH", null, ev, 4095)).toBe(true);
  });

  it("other alert types are unaffected", () => {
    const ev = { ...base, tempThresholdC: 150, vocThresholdPct: 100 };
    expect(passesPersonalThresholds("FULL", { tempC: 1 }, ev, 4095)).toBe(true);
  });
});

describe("alertMessage", () => {
  it("includes the relevant readings per type", () => {
    expect(alertMessage("FILL_THRESHOLD", { level: 80, fillPercent: 83 })).toContain("80%");
    expect(alertMessage("FULL", { fillPercent: 100 })).toMatch(/full/i);
    expect(alertMessage("FIRE", { tempC: 51, vocAnalog: 4000 })).toContain("51");
    expect(alertMessage("TEMP_HIGH", { tempC: 45 })).toContain("45");
    expect(alertMessage("VOC_HIGH", { vocAnalog: 3200 })).toContain("3200");
    expect(alertMessage("OFFLINE", { lastHeartbeatAt: "2026-07-22T11:00:00Z" })).toContain("2026-07-22T11:00:00Z");
    expect(alertMessage("SD_ERROR", {})).toMatch(/SD/);
    expect(alertMessage("CAMERA_ERROR", {})).toMatch(/camera/i);
  });
});
