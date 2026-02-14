import { and, eq, gte, sum, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { TransactionStatus } from "@scuttlepay/shared";

import { db } from "~/server/db";
import type * as schema from "~/server/db/schema/index";
import { spendingPolicies } from "~/server/db/schema/wallet";
import { transactions } from "~/server/db/schema/transaction";
import { addUsdc, compareUsdc, isPositiveUsdc } from "~/server/lib/usdc-math";

export type SpendingDenialCode = "PER_TX_EXCEEDED" | "DAILY_LIMIT_EXCEEDED";

export interface SpendingDenial {
  code: SpendingDenialCode;
  limit: string;
  current: string;
  requested: string;
}

export type SpendingEvaluation =
  | { allowed: true }
  | { allowed: false; denial: SpendingDenial };

export type SpendingServiceErrorCode =
  | "POLICY_NOT_FOUND"
  | "INVALID_AMOUNT";

export class SpendingServiceError extends Error {
  code: SpendingServiceErrorCode;

  constructor(code: SpendingServiceErrorCode, message: string) {
    super(message);
    this.name = "SpendingServiceError";
    this.code = code;
  }
}

function todayUtcStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

type DbOrTx =
  | typeof db
  | PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export async function getPolicy(apiKeyId: string, executor: DbOrTx = db) {
  const policy = await executor
    .select()
    .from(spendingPolicies)
    .where(
      and(
        eq(spendingPolicies.apiKeyId, apiKeyId),
        eq(spendingPolicies.isActive, true),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!policy) {
    throw new SpendingServiceError(
      "POLICY_NOT_FOUND",
      `No active spending policy found for agent ${apiKeyId}`,
    );
  }

  return policy;
}

export async function getDailySpent(
  apiKeyId: string,
  executor: DbOrTx = db,
): Promise<string> {
  const startOfDay = todayUtcStart();

  const result = await executor
    .select({ total: sum(transactions.amountUsdc) })
    .from(transactions)
    .where(
      and(
        eq(transactions.apiKeyId, apiKeyId),
        eq(transactions.status, TransactionStatus.SETTLED),
        gte(transactions.createdAt, startOfDay),
      ),
    )
    .then((rows) => rows[0]);

  return result?.total ?? "0";
}

export async function evaluate(
  apiKeyId: string,
  amountUsdc: string,
  executor: DbOrTx = db,
): Promise<SpendingEvaluation> {
  if (!isPositiveUsdc(amountUsdc)) {
    throw new SpendingServiceError(
      "INVALID_AMOUNT",
      `Invalid amount: ${amountUsdc}`,
    );
  }

  const policy = await getPolicy(apiKeyId, executor);

  if (compareUsdc(amountUsdc, policy.maxPerTx) > 0) {
    return {
      allowed: false,
      denial: {
        code: "PER_TX_EXCEEDED",
        limit: policy.maxPerTx,
        current: "0",
        requested: amountUsdc,
      },
    };
  }

  const dailySpent = await getDailySpent(apiKeyId, executor);

  if (compareUsdc(dailySpent, policy.dailyLimit) >= 0 ||
      compareUsdc(addUsdc(dailySpent, amountUsdc), policy.dailyLimit) > 0) {
    return {
      allowed: false,
      denial: {
        code: "DAILY_LIMIT_EXCEEDED",
        limit: policy.dailyLimit,
        current: dailySpent,
        requested: amountUsdc,
      },
    };
  }

  return { allowed: true };
}
