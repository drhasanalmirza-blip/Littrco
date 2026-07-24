// Pure normalization for device-log ingest (POST /api/device/logs). Kept out of
// storage.ts so it can be unit-tested without a DB (mirrors offlineFinalize.ts).
//
// The sensor ships diagnostic lines at-least-once; the server dedups on
// (deviceId, bootId, seq) at the DB layer. Here we only sanitize each line and
// compute the ackSeq the device uses to advance its unsent cursor.

export type DeviceLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface RawLogLine {
  seq: number;
  level?: DeviceLogLevel;
  tag?: string;
  msg: string;
  atMs?: number;
}

export interface NormLogLine {
  seq: number;
  level: DeviceLogLevel;
  tag: string;
  msg: string;
  atDeviceMs?: number;
}

// Kept in sync with the device_logs column widths; oversized fields are
// truncated (never rejected — a diagnostic line must survive to be seen).
export const LOG_TAG_MAX = 24;
export const LOG_MSG_MAX = 240;

export function normalizeDeviceLogLines(lines: RawLogLine[]): { rows: NormLogLine[]; ackSeq: number } {
  const rows: NormLogLine[] = lines.map((l) => ({
    seq: l.seq,
    level: l.level ?? "INFO",
    tag: (l.tag ?? "").slice(0, LOG_TAG_MAX),
    msg: (l.msg ?? "").slice(0, LOG_MSG_MAX),
    atDeviceMs: l.atMs,
  }));
  // ackSeq = highest seq in the batch (0 for an empty batch). The device stores
  // seqs monotonically per boot, so acking the max confirms the whole batch.
  const ackSeq = rows.reduce((m, r) => (r.seq > m ? r.seq : m), 0);
  return { rows, ackSeq };
}
