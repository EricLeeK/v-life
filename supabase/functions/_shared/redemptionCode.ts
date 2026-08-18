// Redemption-code helpers shared by the redeem-code and redemption-admin
// edge functions (Deno) and the vitest suite (Node). Pure module, zero deps.
// Codes are stored as SHA-256 hashes only; the plaintext exists solely in
// the generation response and the buyer's hands.

// Crockford-style alphabet minus the easily-misread 0, 1, O, I (31 chars ≈ 4.95 bits each).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const RANDOM_CHARS = 16; // ≈ 79 bits of entropy — brute force is infeasible

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Display form: VLXXXX-XXXX-XXXX-XXXX (VL + 16 random chars, dash-grouped). */
export function generateRedemptionCode(): string {
  const body = randomChars(RANDOM_CHARS);
  return `VL${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}

/** Uppercase and strip everything non-alphanumeric (tolerates paste artifacts). */
export function normalizeRedemptionCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** First 8 normalized chars, stored alongside the hash for support lookups. */
export function prefixOf(code: string): string {
  return normalizeRedemptionCode(code).slice(0, 8);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
