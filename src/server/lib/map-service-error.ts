import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import { ScuttlePayError, ErrorCode } from "@scuttlepay/shared";

const ERROR_CODE_MAP: Record<ErrorCode, TRPC_ERROR_CODE_KEY> = {
  [ErrorCode.INSUFFICIENT_BALANCE]: "BAD_REQUEST",
  [ErrorCode.SPENDING_LIMIT_EXCEEDED]: "FORBIDDEN",
  [ErrorCode.VALIDATION_ERROR]: "BAD_REQUEST",
  [ErrorCode.PAYMENT_FAILED]: "INTERNAL_SERVER_ERROR",
  [ErrorCode.PRODUCT_NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.ORDER_CREATION_FAILED]: "INTERNAL_SERVER_ERROR",
  [ErrorCode.WALLET_NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.TRANSACTION_NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.NOT_FOUND]: "NOT_FOUND",
  [ErrorCode.UNAUTHORIZED]: "UNAUTHORIZED",
  [ErrorCode.RATE_LIMITED]: "TOO_MANY_REQUESTS",
  [ErrorCode.DATABASE_ERROR]: "INTERNAL_SERVER_ERROR",
  [ErrorCode.INTERNAL_ERROR]: "INTERNAL_SERVER_ERROR",
};

export function mapServiceError(err: unknown): never {
  if (err instanceof ScuttlePayError) {
    throw new TRPCError({
      code: ERROR_CODE_MAP[err.code],
      message: err.message,
    });
  }
  throw err;
}
