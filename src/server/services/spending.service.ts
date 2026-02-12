import { and, eq, gte, sum } from "drizzle-orm";
import { TransactionStatus } from "@scuttlepay/shared";

import { db } from "~/server/db";
import { spendingPolicies } from "~/server/db/schema/wallet";
import { transactions } from "~/server/db/schema/transaction";

export type SpendingDenialCode = "PER_TX_EXCEEDED" | "DAILY_LIMIT_EXCEEDED";

export interface SpendingDenial {
  code: SpendingDenialCode;
  limit: string;
  current: string;
  requested: string;
}

export interface SpendingEvaluation {
  allowed: boolean;
  denial?: SpendingDenial;
}

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

export async function getPolicy(walletId: string) {
  const policy = await db
    .select()
    .from(spendingPolicies)
    .where(
      and(
        eq(spendingPolicies.walletId, walletId),
        eq(spendingPolicies.isActive, true),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!policy) {
    throw new SpendingServiceError(
      "POLICY_NOT_FOUND",
      `No active spending policy found for wallet ${walletId}`,
    );
  }

  return policy;
}

export async function getDailySpent(walletId: string): Promise<string> {
  const startOfDay = todayUtcStart();

  const result = await db
    .select({ total: sum(transactions.amountUsdc) })
    .from(transactions)
    .where(
      and(
        eq(transactions.walletId, walletId),
        eq(transactions.status, TransactionStatus.SETTLED),
        gte(transactions.createdAt, startOfDay),
      ),
    )
    .then((rows) => rows[0]);

  return result?.total ?? "0";
}

export async function evaluate(
  walletId: string,
  amountUsdc: string,
): Promise<SpendingEvaluation> {
  const amount = Number(amountUsdc);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new SpendingServiceError(
      "INVALID_AMOUNT",
      `Invalid amount: ${amountUsdc}`,
    );
  }

  const policy = await getPolicy(walletId);

  const maxPerTx = Number(policy.maxPerTx);
  if (amount > maxPerTx) {
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

  const dailySpent = await getDailySpent(walletId);
  const dailyTotal = Number(dailySpent) + amount;
  const dailyLimit = Number(policy.dailyLimit);

  if (dailyTotal > dailyLimit) {
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
