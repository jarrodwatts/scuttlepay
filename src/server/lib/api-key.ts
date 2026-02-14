import crypto from "node:crypto";
import { env } from "~/env";

const RANDOM_BYTES = 24;

function getKeyPrefix(): string {
  return env.NODE_ENV === "production" ? "sk_live_" : "sk_test_";
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
