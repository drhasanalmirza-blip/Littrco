// Pure helpers for artifact (firmware .bin / content .raw) storage naming.
// NO fs/db imports — unit-testable. Files are content-addressed (named by their
// SHA-256) so the stored path never contains attacker-controlled bytes beyond a
// validated extension — path-traversal-proof, and identical uploads dedupe.

export const ARTIFACT_KINDS = ["firmware", "content"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

// Extract a safe lowercase extension from a client-supplied filename. Strips any
// path, requires a plain `.ext` of 1–8 alphanumerics, else returns "".
export function safeExt(filename: string): string {
  const base = (filename ?? "").split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ""; // no ext, or dotfile
  const ext = base.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

// Content-addressed stored filename: <sha256><ext>. Throws on a malformed sha so
// a bad hash can never produce a weird path.
export function artifactStoredName(sha256: string, filename: string): string {
  if (!/^[0-9a-f]{64}$/i.test(sha256)) throw new Error("bad sha256");
  return sha256.toLowerCase() + safeExt(filename);
}

// The public, root-relative URL an artifact is served at.
export function artifactRelUrl(kind: ArtifactKind, storedName: string): string {
  return `/uploads/artifacts/${kind}/${storedName}`;
}
