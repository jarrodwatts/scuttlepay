import { index, unique } from "drizzle-orm/pg-core";
import { createTable } from "./table-creator";
import { users } from "./auth";
import { apiKeys } from "./api-key";

export const wallets = createTable(
  "wallet",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    address: d.text().notNull().unique(),
    chainId: d.integer().notNull(),
    label: d.varchar({ length: 255 }).notNull().default("default"),
    thirdwebId: d.text().notNull(),
    isActive: d.boolean().notNull().default(true),
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
  (t) => [index("wallet_user_active_idx").on(t.userId, t.isActive)],
);

export const spendingPolicies = createTable(
  "spending_policy",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    walletId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    apiKeyId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 255 }),
    maxPerTx: d.numeric({ precision: 20, scale: 6 }).notNull(),
    dailyLimit: d.numeric({ precision: 20, scale: 6 }).notNull(),
    monthlyLimit: d.numeric({ precision: 20, scale: 6 }),
    allowedMerchants: d.text().array(),
    isActive: d.boolean().notNull().default(true),
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
  (t) => [unique("spending_policy_api_key_idx").on(t.apiKeyId)],
);
