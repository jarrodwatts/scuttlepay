import crypto from "node:crypto";

const RANDOM_BYTES = 24;

function getKeyPrefix(): string {
  return process.env.NODE_ENV === "production" ? "sk_live_" : "sk_test_";
}

export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const raw = `${getKeyPrefix()}${crypto.randomBytes(RANDOM_BYTES).toString("hex")}`;
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
