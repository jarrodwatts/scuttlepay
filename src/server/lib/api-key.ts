import crypto from "node:crypto";

const KEY_PREFIX = "sk_test_";
const RANDOM_BYTES = 24;

export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const raw = `${KEY_PREFIX}${crypto.randomBytes(RANDOM_BYTES).toString("hex")}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, 12),
  };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function verifyApiKey(raw: string, storedHash: string): boolean {
  const computed = hashApiKey(raw);
  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(storedHash, "hex"),
  );
}
