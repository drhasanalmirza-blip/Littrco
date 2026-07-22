// Alert & notification engine (spec §5). Decision logic lives in
// server/notifyRules.ts (pure, unit-tested); this file does the I/O:
// alert rows, recipient queries, provider dispatch, offline sweep.

import { z } from "zod";
import type { Alert, Device, NotificationPrefs, User } from "@shared/schema";
import { alerts, devices, notificationPrefs, shopMembers, users } from "@shared/schema";
import { db } from "./db";
import { and, desc, eq, gt, isNull, isNotNull, lt } from "drizzle-orm";
import { storage } from "./storage";
import { sendCustomEmail } from "./email";
import { DEFAULT_DEVICE_SETTINGS, mergeDeviceSettings } from "@shared/deviceSettings";
import { VOC_ANALOG_MAX } from "@shared/deviceSettings";
import {
  ALERT_SEVERITY,
  DEVICE_EVENT_TYPES,
  OFFLINE_AFTER_MS,
  SWEEP_INTERVAL_MS,
  EVENT_DEDUPE_WINDOW_MS,
  type AlertSeverity,
  type AlertType,
  type Channel,
  type ChannelPrefs,
  type EventPrefs,
  type PhoneEntry,
  normalizeAlertState,
  evaluateFillAlerts,
  mergeChannelPrefs,
  mergeEventPrefs,
  mergePhoneEntries,
  alertMatchesPrefs,
  passesPersonalThresholds,
  planPhoneDispatch,
  enabledChannels,
  watchedFillLevels,
  fireActionsForEvent,
  alertMessage,
} from "./notifyRules";

// ==================== Providers (spec §5.3) ====================

export interface NotificationTarget {
  userId: string;
  email: string;
  phone: string | null;
}

export interface AlertPayload {
  alertId: number;
  type: AlertType;
  severity: string;
  message: string;
  deviceSerial: string;
  shopId: number | null;
  dataJson: unknown;
}

export interface ProviderResult {
  ok: boolean;
  stub?: boolean;
  error?: string;
}

export interface NotificationProvider {
  send(to: NotificationTarget, alert: AlertPayload): Promise<ProviderResult>;
}

function loggedStub(channel: Channel): NotificationProvider {
  return {
    async send(to, alert) {
      // Clearly-logged stub — Twilio/FCM drop in here later without schema changes
      console.log(
        `[notify] ${channel.toUpperCase()} stub (not sent) → ${to.phone ?? to.email}: ` +
          `[${alert.severity}] ${alert.type} on ${alert.deviceSerial}: ${alert.message}`,
      );
      return { ok: true, stub: true };
    },
  };
}

// sendCustomEmail / emailWrapper intentionally pass HTML through to Resend
// unescaped, so any untrusted value interpolated into the alert email must be
// escaped here. alert.message and alert.deviceSerial originate from device input
// (POST /api/device/events message, MAC-derived serial); without escaping a
// device key holder could inject clickable markup into a LITTR-branded email
// delivered to staff and shop members (phishing amplification). type/severity are
// server-controlled but escaped defensively.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const providers: Record<Channel, NotificationProvider> = {
  email: {
    async send(to, alert) {
      const type = escapeHtml(alert.type);
      const severity = escapeHtml(alert.severity);
      const deviceSerial = escapeHtml(alert.deviceSerial);
      const message = escapeHtml(alert.message);
      const subject = `[LITTR ${severity}] ${type} — bin ${deviceSerial}`;
      const html = `
        <h2 style="margin: 0 0 8px 0; color: #000; font-size: 24px; font-weight: 600;">${type.replace(/_/g, " ")}</h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">Bin <strong style="color: #000;">${deviceSerial}</strong> — severity ${severity}</p>
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px;">
          <p style="margin: 0; color: #000; font-size: 15px; line-height: 1.6;">${message}</p>
        </div>`;
      const r = await sendCustomEmail(to.email, subject, html);
      return r.success ? { ok: true } : { ok: false, error: String((r as any).error ?? "send failed") };
    },
  },
  sms: loggedStub("sms"),
  call: loggedStub("call"),
  push: loggedStub("push"),
};

// ==================== Recipients (spec §5.5) ====================

interface Recipient extends NotificationTarget {
  channels: ChannelPrefs;
  events: EventPrefs;
  phones: PhoneEntry[];
}

function toRecipient(user: User, prefs: NotificationPrefs | null): Recipient {
  const channels = mergeChannelPrefs(prefs?.channelsJson);
  let phones = mergePhoneEntries((prefs as any)?.phonesJson);
  // Back-compat: a legacy single `phone` (with sms/call channel toggles) acts as
  // one entry until the user saves the new multi-number prefs.
  if (phones.length === 0 && prefs?.phone && (channels.sms || channels.call)) {
    phones = [{ number: prefs.phone, sms: channels.sms, call: channels.call, minSeverity: "WARNING" }];
  }
  return {
    userId: user.id,
    email: user.email,
    phone: prefs?.phone ?? null,
    channels,
    events: mergeEventPrefs(prefs?.eventsJson),
    phones,
  };
}

// All STAFF (global-scope prefs) + members of the device's shop (shop-scope
// prefs). Users with no prefs row get the §5.3 defaults (FULL + FIRE enabled).
// staffOnly limits to STAFF (used for FIRE_DISABLED oversight alerts).
async function gatherRecipients(
  device: Pick<Device, "shopId">,
  opts?: { staffOnly?: boolean },
): Promise<Recipient[]> {
  const byUser = new Map<string, Recipient>();

  const staffRows = await db
    .select({ user: users, prefs: notificationPrefs })
    .from(users)
    .leftJoin(notificationPrefs, and(eq(notificationPrefs.userId, users.id), isNull(notificationPrefs.shopId)))
    .where(eq(users.role, "STAFF"));
  for (const { user, prefs } of staffRows) byUser.set(user.id, toRecipient(user, prefs));

  if (!opts?.staffOnly && device.shopId != null) {
    const memberRows = await db
      .select({ user: users, prefs: notificationPrefs })
      .from(shopMembers)
      .innerJoin(users, eq(users.id, shopMembers.userId))
      .leftJoin(notificationPrefs, and(eq(notificationPrefs.userId, users.id), eq(notificationPrefs.shopId, device.shopId)))
      .where(eq(shopMembers.shopId, device.shopId));
    // Shop-scope prefs win for a user who is both STAFF and a member of this shop
    for (const { user, prefs } of memberRows) byUser.set(user.id, toRecipient(user, prefs));
  }

  return Array.from(byUser.values());
}

// ==================== Alert creation & dispatch ====================

async function createAlert(
  device: Device,
  type: AlertType,
  message: string,
  dataJson: Record<string, unknown> | null,
): Promise<Alert> {
  const [row] = await db
    .insert(alerts)
    .values({
      deviceId: device.id,
      shopId: device.shopId,
      type,
      severity: ALERT_SEVERITY[type],
      message,
      dataJson,
    })
    .returning();
  return row;
}

interface DeliveryReceipt {
  userId: string;
  email: string;
  channel: Channel;
  number?: string; // present for sms/call (deduped per-number dispatch)
  ok: boolean;
  stub?: boolean;
  error?: string;
  at: string;
}

// Notify every recipient whose prefs opt into this alert. Email/push go per
// recipient; SMS/call go per PHONE NUMBER — numbers are pooled across all
// matching recipients and deduped (a number shared by two accounts is contacted
// once with the union of their channels). Per-recipient/-number results are
// recorded into alerts.notifiedJson (spec §5.5).
async function dispatchAlert(
  alert: Alert,
  device: Device,
  opts?: { recipients?: Recipient[] },
): Promise<void> {
  const recipients = opts?.recipients ?? (await gatherRecipients(device));
  const payload: AlertPayload = {
    alertId: alert.id,
    type: alert.type as AlertType,
    severity: alert.severity,
    message: alert.message,
    deviceSerial: device.serial,
    shopId: alert.shopId,
    dataJson: alert.dataJson,
  };
  const data = alert.dataJson as { level?: number; tempC?: number; vocAnalog?: number } | null;

  const matching = recipients.filter(
    (r) =>
      alertMatchesPrefs(payload.type, data, r.events) &&
      passesPersonalThresholds(payload.type, data, r.events, VOC_ANALOG_MAX),
  );

  const receipts: DeliveryReceipt[] = [];

  // Email / push: per recipient
  for (const r of matching) {
    for (const channel of enabledChannels(r.channels).filter((c) => c === "email" || c === "push")) {
      let result: ProviderResult;
      try {
        result = await providers[channel].send(r, payload);
      } catch (e: any) {
        result = { ok: false, error: String(e?.message ?? e) };
      }
      receipts.push({ userId: r.userId, email: r.email, channel, ...result, at: new Date().toISOString() });
    }
  }

  // SMS / call: per deduped phone number across all matching recipients
  const phonePlan = planPhoneDispatch(matching, alert.severity as AlertSeverity);
  for (const entry of phonePlan) {
    const target: NotificationTarget = { userId: entry.userIds.join(","), email: "", phone: entry.number };
    for (const channel of ["sms", "call"] as const) {
      if (!entry[channel]) continue;
      let result: ProviderResult;
      try {
        result = await providers[channel].send(target, payload);
      } catch (e: any) {
        result = { ok: false, error: String(e?.message ?? e) };
      }
      receipts.push({
        userId: entry.userIds[0],
        email: "",
        channel,
        number: entry.number,
        ...result,
        at: new Date().toISOString(),
      });
    }
  }

  await db.update(alerts).set({ notifiedJson: receipts }).where(eq(alerts.id, alert.id));
}

async function resolveOpenAlerts(deviceId: number, type: AlertType): Promise<void> {
  await db
    .update(alerts)
    .set({ resolvedAt: new Date() })
    .where(and(eq(alerts.deviceId, deviceId), eq(alerts.type, type), isNull(alerts.resolvedAt)));
}

// ==================== Trigger 1: telemetry ingest (spec §5.1.1) ====================

export async function evaluateTelemetry(deviceBefore: Device, deviceAfter: Device): Promise<void> {
  try {
    // Heartbeat clears the offline latch and auto-resolves the OFFLINE alert
    if (deviceAfter.offlineNotifiedAt) {
      await storage.updateDevice(deviceAfter.id, { offlineNotifiedAt: null });
      await resolveOpenAlerts(deviceAfter.id, "OFFLINE");
    }

    // Crossing "upward" requires movement; unchanged fill can't trigger or re-arm
    if (deviceAfter.fillPercent === deviceBefore.fillPercent) return;

    const recipients = await gatherRecipients(deviceAfter);
    const watched = watchedFillLevels(recipients.map((r) => r.events));
    const prevState = normalizeAlertState(deviceAfter.alertStateJson);
    const result = evaluateFillAlerts(prevState, deviceAfter.fillPercent, watched);

    if (result.changed) {
      await storage.updateDevice(deviceAfter.id, { alertStateJson: result.state });
    }

    for (const level of result.crossedLevels) {
      const data = { level, fillPercent: deviceAfter.fillPercent };
      const alert = await createAlert(deviceAfter, "FILL_THRESHOLD", alertMessage("FILL_THRESHOLD", data), data);
      await dispatchAlert(alert, deviceAfter, { recipients });
    }
    if (result.fullTriggered) {
      const data = { fillPercent: deviceAfter.fillPercent };
      const alert = await createAlert(deviceAfter, "FULL", alertMessage("FULL", data), data);
      await dispatchAlert(alert, deviceAfter, { recipients });
    }
  } catch (e) {
    // Alerting must never fail the telemetry ingest
    console.error("[notify] evaluateTelemetry failed:", e);
  }
}

// ==================== Trigger 2: device events (spec §5.1.2, §2.2) ====================

const deviceEventSchema = z.object({
  type: z.enum(DEVICE_EVENT_TYPES),
  tempC: z.number().optional(),
  vocAnalog: z.number().optional(),
  fillPercent: z.number().optional(),
  message: z.string().max(500).optional(),
});

export async function handleDeviceEvent(device: Device, evt: unknown): Promise<number | null> {
  const parsed = deviceEventSchema.safeParse(evt);
  if (!parsed.success) return null;
  const event = parsed.data;

  try {
    const dataJson: Record<string, unknown> = {};
    for (const k of ["tempC", "vocAnalog", "fillPercent", "message"] as const) {
      if (event[k] !== undefined) dataJson[k] = event[k];
    }

    // 10-minute unresolved-alert refresh dedupe (§2.2): update dataJson, don't
    // duplicate — and don't re-notify or re-run fire actions.
    const [existing] = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.deviceId, device.id),
          eq(alerts.type, event.type),
          isNull(alerts.resolvedAt),
          gt(alerts.createdAt, new Date(Date.now() - EVENT_DEDUPE_WINDOW_MS)),
        ),
      )
      .orderBy(desc(alerts.createdAt))
      .limit(1);
    if (existing) {
      await db.update(alerts).set({ dataJson }).where(eq(alerts.id, existing.id));
      return existing.id;
    }

    const message = event.message ?? alertMessage(event.type, event);
    const alert = await createAlert(device, event.type, message, dataJson);

    // Bin-local fire actions from device settings: ALARM → enqueue SOUND_ALARM
    // as a server-side backup (the bin also alarms locally); DISPLAY is handled
    // entirely on the bin. Who gets notified is decided purely by each user's
    // notification prefs in dispatchAlert — actions no longer force channels.
    if (event.type === "FIRE") {
      const stored = await storage.getDeviceSettings(device.id);
      const settings = mergeDeviceSettings(
        DEFAULT_DEVICE_SETTINGS as Record<string, unknown>,
        (stored?.settingsJson as Record<string, unknown>) ?? {},
      ) as typeof DEFAULT_DEVICE_SETTINGS;
      const actions = fireActionsForEvent(settings.fire as any, event);
      if (actions.includes("ALARM")) {
        await storage.enqueueCommand(device.id, "SOUND_ALARM", { seconds: 60 });
      }
    }

    await dispatchAlert(alert, device);
    return alert.id;
  } catch (e) {
    console.error("[notify] handleDeviceEvent failed:", e);
    return null;
  }
}

// ==================== Fire-detection oversight ====================

/**
 * A PARTNER turned fire detection off for a bin. Fire safety is a staff
 * oversight concern: record a FIRE_DISABLED alert and notify STAFF only
 * (partners can see the alert row in their shop's alert list, but no partner
 * notifications go out for it).
 */
export async function notifyFireDisabled(device: Device, disabledByEmail: string): Promise<void> {
  try {
    const data = { disabledBy: disabledByEmail };
    const alert = await createAlert(device, "FIRE_DISABLED", alertMessage("FIRE_DISABLED", data), data);
    const staff = await gatherRecipients(device, { staffOnly: true });
    await dispatchAlert(alert, device, { recipients: staff });
  } catch (e) {
    console.error("[notify] notifyFireDisabled failed:", e);
  }
}

// ==================== Trigger 3: offline sweep (spec §5.1.3) ====================

let sweepTimer: NodeJS.Timeout | null = null;

export function startOfflineSweep(): void {
  if (sweepTimer) return; // guard against double-start
  sweepTimer = setInterval(() => {
    runOfflineSweep().catch((e) => console.error("[notify] offline sweep failed:", e));
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
  // Immediate pass so devices that went silent while the server was down are
  // flagged without waiting a full interval (the DB latch prevents re-notifying)
  runOfflineSweep().catch((e) => console.error("[notify] offline sweep failed:", e));
}

async function runOfflineSweep(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - OFFLINE_AFTER_MS);

  // LIVE devices silent >10 min, not yet flagged (offlineNotifiedAt latch)
  const silent = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.status, "LIVE"),
        isNull(devices.offlineNotifiedAt),
        isNotNull(devices.lastHeartbeatAt),
        lt(devices.lastHeartbeatAt, cutoff),
      ),
    );
  for (const device of silent) {
    const data = { lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() };
    const alert = await createAlert(device, "OFFLINE", alertMessage("OFFLINE", data), data);
    await storage.updateDevice(device.id, { offlineNotifiedAt: now });
    await dispatchAlert(alert, device);
  }

  // Recovered devices (heartbeat came back between sweeps without telemetry
  // ingest clearing it): drop the latch and auto-resolve
  const recovered = await db
    .select()
    .from(devices)
    .where(and(isNotNull(devices.offlineNotifiedAt), gt(devices.lastHeartbeatAt, cutoff)));
  for (const device of recovered) {
    await storage.updateDevice(device.id, { offlineNotifiedAt: null });
    await resolveOpenAlerts(device.id, "OFFLINE");
  }
}
