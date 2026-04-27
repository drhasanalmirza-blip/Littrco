// Helpers for working with server responses that wrap their payload in an
// envelope like { ok: true, <key>: <data> }. Frontend callers should use these
// helpers so that envelope shapes don't silently leak into UI state or
// outbound mutation payloads.

export type Envelope<T> = { ok?: boolean; error?: string } & Record<string, T>;

/**
 * Unwrap a single keyed payload from an envelope response. If the response is
 * already the bare payload (no `ok` field and the key is missing), returns it
 * unchanged. Returns `undefined` when neither shape is present.
 */
export function unwrapEnvelope<T>(
  data: unknown,
  key: string,
): T | undefined {
  if (data == null) return undefined;
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (key in obj) return obj[key] as T;
    if (!("ok" in obj)) return data as T;
  }
  return undefined;
}
