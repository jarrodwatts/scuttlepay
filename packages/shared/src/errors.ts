export const ErrorCode = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  SPENDING_LIMIT_EXCEEDED: "SPENDING_LIMIT_EXCEEDED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  ORDER_CREATION_FAILED: "ORDER_CREATION_FAILED",
  WALLET_NOT_FOUND: "WALLET_NOT_FOUND",
  TRANSACTION_NOT_FOUND: "TRANSACTION_NOT_FOUND",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const HTTP_STATUS = {
  [ErrorCode.INSUFFICIENT_BALANCE]: 400,
  [ErrorCode.SPENDING_LIMIT_EXCEEDED]: 400,
  [ErrorCode.PAYMENT_FAILED]: 502,
  [ErrorCode.PRODUCT_NOT_FOUND]: 404,
  [ErrorCode.ORDER_CREATION_FAILED]: 502,
  [ErrorCode.WALLET_NOT_FOUND]: 404,
  [ErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.DATABASE_ERROR]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
} as const satisfies Record<ErrorCode, number>;

export type ScuttlePayHttpStatus =
  (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export class ScuttlePayError extends Error {
  readonly code: ErrorCode;
  readonly retriable: boolean;
  readonly metadata: Record<string, unknown>;
  readonly httpStatus: ScuttlePayHttpStatus;

  constructor(params: {
    code: ErrorCode;
    message: string;
    retriable?: boolean;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "ScuttlePayError";
    this.code = params.code;
    this.retriable = params.retriable ?? false;
    this.metadata = params.metadata ?? {};
    this.httpStatus = HTTP_STATUS[params.code];
  }
}

export function isScuttlePayError(err: unknown): err is ScuttlePayError {
  return err instanceof ScuttlePayError;
}

export function toAgentMessage(err: ScuttlePayError): string {
  switch (err.code) {
    case ErrorCode.INSUFFICIENT_BALANCE:
      return `Insufficient balance: you have $${err.metadata["available"] ?? "?"} USDC but this costs $${err.metadata["required"] ?? "?"} USDC.`;
    case ErrorCode.SPENDING_LIMIT_EXCEEDED:
      return `Spending limit exceeded: ${err.metadata["period"] ?? "per-transaction"} limit is $${err.metadata["limit"] ?? "?"}, already spent $${err.metadata["spent"] ?? "0"}.`;
    case ErrorCode.PAYMENT_FAILED:
      return `Payment failed: ${err.message}${err.retriable ? " You can try again." : ""}`;
    case ErrorCode.PRODUCT_NOT_FOUND:
      return `Product not found: ${err.metadata["productId"] ?? "unknown product"}.`;
    case ErrorCode.ORDER_CREATION_FAILED:
      return `Payment succeeded (tx: ${err.metadata["txHash"] ?? "?"}), but order creation failed: ${err.message}`;
    case ErrorCode.WALLET_NOT_FOUND:
      return "Wallet not found. Please check your configuration.";
    case ErrorCode.TRANSACTION_NOT_FOUND:
      return "Transaction not found.";
    case ErrorCode.NOT_FOUND:
      return `Not found: ${err.message}`;
    case ErrorCode.UNAUTHORIZED:
      return "Unauthorized. Please check your API key.";
    case ErrorCode.VALIDATION_ERROR:
      return `Invalid request: ${err.message}`;
    case ErrorCode.RATE_LIMITED:
      return "Too many requests. Please slow down and try again.";
    case ErrorCode.DATABASE_ERROR:
      return "A database error occurred. Please try again later.";
    case ErrorCode.INTERNAL_ERROR:
      return "An internal error occurred. Please try again later.";
  }
}

export function toApiResponse(err: ScuttlePayError): {
  error: { code: ErrorCode; message: string; retriable: boolean };
} {
  return {
    error: {
      code: err.code,
      message: err.message,
      retriable: err.retriable,
    },
  };
}
