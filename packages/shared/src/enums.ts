export const TransactionType = {
  PURCHASE: "purchase",
  FUND: "fund",
  REFUND: "refund",
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: "pending",
  SETTLING: "settling",
  SETTLED: "settled",
  FAILED: "failed",
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const OrderStatus = {
  CREATED: "created",
  CONFIRMED: "confirmed",
  FAILED: "failed",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
