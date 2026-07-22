import { apiRequest } from "@/lib/store";

/**
 * GET `url` via apiRequest, check ok, parse JSON.
 * Throws Error(body.error || "HTTP <status>") on non-2xx.
 */
export async function apiJson<T = any>(url: string): Promise<T> {
  const r = await apiRequest(url);
  if (!r.ok) {
    throw new Error(
      (await r.json().catch(() => ({} as any))).error || "HTTP " + r.status,
    );
  }
  return r.json();
}

/**
 * Mutation helper: <method> `url` with an optional JSON body.
 * Throws Error(body.error || "HTTP <status>") on non-2xx.
 * Returns parsed JSON, or {} when the response has no JSON body.
 */
export async function apiSend<T = any>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const r = await apiRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    throw new Error(
      (await r.json().catch(() => ({} as any))).error || "HTTP " + r.status,
    );
  }
  return r.json().catch(() => ({} as T));
}
