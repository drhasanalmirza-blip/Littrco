import { describe, it, expect } from "vitest";
import {
  normalizeDeviceLogLines,
  LOG_TAG_MAX,
  LOG_MSG_MAX,
  type RawLogLine,
} from "../deviceLogsIngest";

describe("normalizeDeviceLogLines", () => {
  it("defaults a missing level to INFO and a missing tag to empty", () => {
    const { rows } = normalizeDeviceLogLines([{ seq: 1, msg: "hi" } as RawLogLine]);
    expect(rows[0]).toEqual({ seq: 1, level: "INFO", tag: "", msg: "hi", atDeviceMs: undefined });
  });

  it("preserves an explicit level, tag, and atMs (mapped to atDeviceMs)", () => {
    const { rows } = normalizeDeviceLogLines([
      { seq: 7, level: "ERROR", tag: "temp", msg: "bus scan: 0 devices", atMs: 1523 },
    ]);
    expect(rows[0]).toEqual({
      seq: 7, level: "ERROR", tag: "temp", msg: "bus scan: 0 devices", atDeviceMs: 1523,
    });
  });

  it("truncates oversized tag and msg instead of rejecting them", () => {
    const longTag = "x".repeat(LOG_TAG_MAX + 10);
    const longMsg = "y".repeat(LOG_MSG_MAX + 100);
    const { rows } = normalizeDeviceLogLines([{ seq: 1, tag: longTag, msg: longMsg }]);
    expect(rows[0].tag).toHaveLength(LOG_TAG_MAX);
    expect(rows[0].msg).toHaveLength(LOG_MSG_MAX);
  });

  it("ackSeq is the highest seq in the batch regardless of order", () => {
    const lines: RawLogLine[] = [
      { seq: 41, msg: "a" },
      { seq: 44, msg: "b" },
      { seq: 42, msg: "c" },
    ];
    expect(normalizeDeviceLogLines(lines).ackSeq).toBe(44);
  });

  it("empty batch yields no rows and ackSeq 0", () => {
    expect(normalizeDeviceLogLines([])).toEqual({ rows: [], ackSeq: 0 });
  });
});
