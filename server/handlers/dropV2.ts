import type { Request, Response } from "express";
import type { IStorage } from "../storage";

function rollPointsV2(): number {
  return Math.floor(Math.random() * 3) + 1;
}

function rollPointsDemo(): number {
  return Math.floor(Math.random() * 10) + 1;
}

function rollPointsFromTable(table: Array<{ points: number; weight: number }>): number {
  if (!Array.isArray(table) || table.length === 0) return rollPointsV2();
  const total = table.reduce((s, e) => s + (e.weight || 0), 0);
  if (total <= 0) return rollPointsV2();
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.weight || 0;
    if (r <= 0) return Math.max(0, Math.floor(e.points));
  }
  return Math.max(0, Math.floor(table[table.length - 1].points));
}

export type DropV2Storage = Pick<
  IStorage,
  | "getDeviceByUid"
  | "updateDeviceLastSeen"
  | "getDropEventByDeviceEventId"
  | "getRewardSession"
  | "getBinByDeviceId"
  | "getDeviceConfig"
  | "getDropByEventId"
  | "getRewardConfig"
  | "createDropEventIdempotent"
  | "processDropAtomic"
>;

export function createDropV2Handler(
  store: DropV2Storage,
  generateToken: () => string,
) {
  return async function dropV2(req: Request, res: Response) {
    try {
      const { uid, event_id } = req.body;
      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid required" });
      }

      const device = await store.getDeviceByUid(uid);
      if (!device || !device.shopId || device.status !== "ACTIVE") {
        return res.status(400).json({ ok: false, error: "Device not paired or inactive" });
      }

      await store.updateDeviceLastSeen(device.id);

      const replayDuplicate = async (existing: { sessionId: number | null }) => {
        const session = existing.sessionId ? await store.getRewardSession(existing.sessionId) : null;
        const dupBin = await store.getBinByDeviceId(device.id);
        let dupRejected = false;
        let dupRejectionReason: string | null = null;
        if (event_id) {
          const dupDrop = await store.getDropByEventId(event_id);
          if (dupDrop?.verdictReady && dupDrop.verdictAccepted === false && dupBin) {
            const reason = dupDrop.verdictReason ?? '';
            if ((reason === 'thc_vape' && dupBin.rejectThcVapes) || (reason === 'not_a_vape' && dupBin.rejectNonVapes)) {
              dupRejected = true;
              dupRejectionReason = reason;
            }
          }
        }
        return res.json({
          ok: true,
          duplicate: true,
          sessionId: session?.id ?? null,
          points: session?.pointsTotal ?? 0,
          qr_url: session ? `https://littr.co/app/claim?token=${session.token}` : null,
          stackCount: session?.dropCount ?? 0,
          mode: dupBin?.mode ?? 'demo',
          rejected: dupRejected,
          rejectionReason: dupRejectionReason,
        });
      };

      if (event_id) {
        const existing = await store.getDropEventByDeviceEventId(event_id);
        if (existing) {
          return await replayDuplicate(existing);
        }
      }

      const config = await store.getDeviceConfig(device.shopId);
      const sessionWindowSec = config?.sessionWindowSec ?? 60;

      const bin = await store.getBinByDeviceId(device.id);
      if (bin && bin.status === 'PENDING_SETUP') {
        return res.status(409).json({
          ok: false,
          error: 'bin_not_configured',
          message: 'Bin is awaiting staff setup. No rewards until configured.',
        });
      }
      const mode: 'demo' | 'normal' = bin?.mode ?? 'demo';

      let points: number;
      let rejected = false;
      let rejectionReason: string | null = null;

      if (mode === 'demo') {
        points = rollPointsDemo();
      } else {
        const gatingEnabled = !!(bin && (bin.rejectThcVapes || bin.rejectNonVapes));
        const existingDrop = event_id ? await store.getDropByEventId(event_id) : undefined;

        if (gatingEnabled && (!existingDrop || !existingDrop.verdictReady)) {
          return res.json({
            ok: true,
            pending: true,
            reason: 'awaiting_classifier_verdict',
            mode,
            retryAfterMs: 1000,
          });
        }

        if (existingDrop?.verdictReady && existingDrop.verdictAccepted === false && bin) {
          const reason = existingDrop.verdictReason ?? '';
          const isThc = reason === 'thc_vape';
          const isNonVape = reason === 'not_a_vape';
          if ((isThc && bin.rejectThcVapes) || (isNonVape && bin.rejectNonVapes)) {
            points = 0;
            rejected = true;
            rejectionReason = reason;
          } else {
            const rewardConfig = await store.getRewardConfig(device.shopId);
            const table = (rewardConfig?.rewardTableJson as Array<{ points: number; weight: number }> | undefined) ?? [];
            points = (rewardConfig?.enabled ?? true) ? rollPointsFromTable(table) : 0;
          }
        } else {
          const rewardConfig = await store.getRewardConfig(device.shopId);
          const table = (rewardConfig?.rewardTableJson as Array<{ points: number; weight: number }> | undefined) ?? [];
          points = (rewardConfig?.enabled ?? true) ? rollPointsFromTable(table) : 0;
        }
      }

      if (rejected) {
        await store.createDropEventIdempotent({
          shopId: device.shopId,
          deviceId: device.id,
          deviceEventId: event_id || null,
          sessionId: null,
          pointsAwarded: 0,
        });
        return res.json({
          ok: true,
          sessionId: null,
          points: 0,
          qr_url: null,
          stackCount: 0,
          mode,
          rejected: true,
          rejectionReason,
        });
      }

      const { duplicate, dropEvent, session } = await store.processDropAtomic({
        deviceId: device.id,
        shopId: device.shopId,
        eventId: event_id || null,
        points,
        sessionWindowSec,
        generateToken,
      });

      if (duplicate) {
        return await replayDuplicate(dropEvent);
      }

      res.json({
        ok: true,
        sessionId: session.id,
        points: session.pointsTotal,
        qr_url: `https://littr.co/app/claim?token=${session.token}`,
        stackCount: session.dropCount,
        mode,
        rejected,
        rejectionReason,
      });
    } catch (error) {
      console.error("V2 drop error:", error);
      res.status(500).json({ ok: false, error: "Drop failed" });
    }
  };
}
