import { index } from "drizzle-orm/pg-core";
import type { TransactionType, TransactionStatus, OrderStatus } from "@scuttlepay/shared";
import { createTable } from "./table-creator";
import { wallets } from "./wallet";
import { apiKeys } from "./api-key";

export const transactions = createTable(
  "transaction",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    walletId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    apiKeyId: d
      .varchar({ length: 255 })
      .references(() => apiKeys.id, { onDelete: "set null" }),
    type: d
      .varchar({ length: 20 })
      .notNull()
      .$type<TransactionType>(),
    status: d
      .varchar({ length: 20 })
      .notNull()
      .$type<TransactionStatus>(),
    amountUsdc: d.numeric({ precision: 20, scale: 6 }).notNull(),
    txHash: d.text(),
    merchantAddress: d.text(),
    productId: d.text(),
    productName: d.text(),
    storeUrl: d.text(),
    errorMessage: d.text(),
    metadata: d.jsonb().$type<Record<string, unknown>>(),
    initiatedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    settledAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [
    index("transaction_wallet_status_idx").on(t.walletId, t.status),
    index("transaction_wallet_created_idx").on(t.walletId, t.createdAt),
    index("transaction_api_key_status_created_idx").on(t.apiKeyId, t.status, t.createdAt),
  ],
);

export const orders = createTable(
  "order",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionId: d
      .varchar({ length: 255 })
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: "restrict" }),
    walletId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    shopifyOrderId: d.text(),
    shopifyOrderNumber: d.text(),
    status: d
      .varchar({ length: 20 })
      .notNull()
      .$type<OrderStatus>(),
    productId: d.text().notNull(),
    productName: d.text().notNull(),
    variantId: d.text(),
    quantity: d.integer().notNull().default(1),
    unitPriceUsdc: d.numeric({ precision: 20, scale: 6 }).notNull(),
    totalUsdc: d.numeric({ precision: 20, scale: 6 }).notNull(),
    storeUrl: d.text().notNull(),
    errorMessage: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  }),
  (t) => [index("order_wallet_id_idx").on(t.walletId)],
);
