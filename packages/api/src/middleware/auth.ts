import type { MiddlewareHandler } from "hono";
import { eq, and } from "drizzle-orm";
import { ScuttlePayError, ErrorCode } from "@scuttlepay/shared";
import type { Database } from "../db/index.js";
import { apiKeys, wallets } from "../db/schema.js";
import { verifyApiKey } from "../lib/api-key.js";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    walletId: string;
  }
}

function parseBearer(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new ScuttlePayError({
      code: ErrorCode.UNAUTHORIZED,
      message: "Missing or invalid Authorization header",
    });
  }

  const token = header.slice(7);
  if (!token.startsWith("sk_")) {
    throw new ScuttlePayError({
      code: ErrorCode.UNAUTHORIZED,
      message: "Invalid API key format",
    });
  }

  return token;
}

async function findMatchingKey(
  db: Database,
  token: string,
): Promise<typeof apiKeys.$inferSelect> {
  const prefix = token.slice(0, 12);
  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.isActive, true)));

  for (const candidate of candidates) {
    try {
      if (verifyApiKey(token, candidate.keyHash)) {
        return candidate;
      }
    } catch (err: unknown) {
      console.error(
        `[auth] Key verification failed for key ${candidate.id}:`,
        err,
      );
      continue;
    }
  }

  throw new ScuttlePayError({
    code: ErrorCode.UNAUTHORIZED,
    message: "Invalid API key",
  });
}

async function findDefaultWallet(
  db: Database,
  userId: string,
): Promise<typeof wallets.$inferSelect> {
  const results = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.isActive, true)))
    .limit(1);

  const wallet = results[0];
  if (!wallet) {
    throw new ScuttlePayError({
      code: ErrorCode.WALLET_NOT_FOUND,
      message: "No active wallet found for this user",
    });
  }

  return wallet;
}

export function authMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const token = parseBearer(c.req.header("Authorization"));
    const key = await findMatchingKey(db, token);

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new ScuttlePayError({
        code: ErrorCode.UNAUTHORIZED,
        message: "API key expired",
      });
    }

    const wallet = await findDefaultWallet(db, key.userId);

    c.set("userId", key.userId);
    c.set("walletId", wallet.id);

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch((err: unknown) => {
        console.error(
          `[auth] Failed to update last_used_at for key ${key.id}:`,
          err,
        );
      });

    await next();
  };
}
