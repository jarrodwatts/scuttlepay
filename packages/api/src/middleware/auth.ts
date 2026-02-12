import type { MiddlewareHandler } from "hono";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { ScuttlePayError, ErrorCode } from "@scuttlepay/shared";
import type { Database } from "../db/index.js";
import { apiKeys, wallets } from "../db/schema.js";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    walletId: string;
  }
}

export function authMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
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

    const prefix = token.slice(0, 12);
    const candidates = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.isActive, true)));

    let matchedKey: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      const valid = await bcrypt.compare(token, candidate.keyHash);
      if (valid) {
        matchedKey = candidate;
        break;
      }
    }

    if (!matchedKey) {
      throw new ScuttlePayError({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid API key",
      });
    }

    if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
      throw new ScuttlePayError({
        code: ErrorCode.UNAUTHORIZED,
        message: "API key expired",
      });
    }

    const userWallets = await db
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.userId, matchedKey.userId), eq(wallets.isActive, true)),
      )
      .limit(1);

    const defaultWallet = userWallets[0];
    if (!defaultWallet) {
      throw new ScuttlePayError({
        code: ErrorCode.WALLET_NOT_FOUND,
        message: "No active wallet found for this user",
      });
    }

    c.set("userId", matchedKey.userId);
    c.set("walletId", defaultWallet.id);

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, matchedKey.id))
      .then(() => {})
      .catch(() => {});

    await next();
  };
}
