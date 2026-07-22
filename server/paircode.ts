import crypto from "crypto";

// Pair-code generator (spec §1.3 pairing_codes / §2.3). Pure module — no db
// import, safe for unit tests.
//
// 32-char alphabet: uppercase alphanumerics minus the look-alikes 0/O/1/I.
// 6 chars → 32^6 ≈ 1.07B codes; combined with single-use + 10-min TTL + the
// 10/min/IP limit on /api/device/claim-by-code, brute force is impractical.
export const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIR_CODE_LENGTH = 6;

export function generatePairCode(): string {
  let code = "";
  for (let i = 0; i < PAIR_CODE_LENGTH; i++) {
    // crypto.randomInt is uniform (no modulo bias)
    code += PAIR_CODE_ALPHABET[crypto.randomInt(PAIR_CODE_ALPHABET.length)];
  }
  return code;
}
