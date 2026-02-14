import { and, eq, isNull, or, gt } from "drizzle-orm";

import { db } from "~/server/db";
import { apiKeys } from "~/server/db/schema/api-key";
import { wallets } from "~/server/db/schema/wallet";
import { hashApiKey } from "~/server/lib/api-key";

export interface ApiKeyContext {
  userId: string;
  walletId: string;
  apiKeyId: string;
}

export async function validateApiKey(
  authHeader: string | null,
): Promise<ApiKeyContext> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiKeyError("Missing or malformed Authorization header");
  }

  const rawKey = authHeader.slice("Bearer ".length);
  if (!rawKey.startsWith("sk_")) {
    throw new ApiKeyError("Invalid API key format");
  }

  const keyHash = hashApiKey(rawKey);

  const row = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    throw new ApiKeyError("Invalid or expired API key");
  }

  const wallet = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, row.userId), eq(wallets.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!wallet) {
    throw new ApiKeyError("No active wallet found for this API key");
  }

  void db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .execute()
    .catch((err: unknown) => console.error("[validate-api-key] Failed to update lastUsedAt", err));

  return { userId: row.userId, walletId: wallet.id, apiKeyId: row.id };
}

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}
