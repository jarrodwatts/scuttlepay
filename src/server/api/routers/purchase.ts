import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import {
  purchaseRequestSchema,
  purchaseResultSchema,
  ScuttlePayError,
  ErrorCode,
} from "@scuttlepay/shared";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { purchase } from "~/server/services/purchase.service";

const ERROR_CODE_MAP: Partial<Record<ErrorCode, TRPC_ERROR_CODE_KEY>> = {
  [ErrorCode.INSUFFICIENT_BALANCE]: "BAD_REQUEST",
  [ErrorCode.SPENDING_LIMIT_EXCEEDED]: "FORBIDDEN",
  [ErrorCode.PAYMENT_FAILED]: "INTERNAL_SERVER_ERROR",
  [ErrorCode.PRODUCT_NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.VALIDATION_ERROR]: "BAD_REQUEST",
  [ErrorCode.WALLET_NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.DATABASE_ERROR]: "INTERNAL_SERVER_ERROR",
  [ErrorCode.INTERNAL_ERROR]: "INTERNAL_SERVER_ERROR",
};

function mapServiceError(err: unknown): never {
  if (err instanceof ScuttlePayError) {
    throw new TRPCError({
      code: ERROR_CODE_MAP[err.code] ?? "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw err;
}

function requireWalletId(walletId: string | null): string {
  if (!walletId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No active wallet found",
    });
  }
  return walletId;
}

export const purchaseRouter = createTRPCRouter({
  execute: authedProcedure
    .input(purchaseRequestSchema)
    .output(purchaseResultSchema)
    .mutation(async ({ ctx, input }) => {
      const walletId = requireWalletId(ctx.walletId);

      try {
        return await purchase({
          walletId,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
        });
      } catch (err) {
        mapServiceError(err);
      }
    }),
});
