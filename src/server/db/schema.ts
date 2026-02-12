import { relations } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
} from "drizzle-orm/pg-core";
type AdapterAccountType = "email" | "oidc" | "oauth" | "webauthn";

export const createTable = pgTableCreator((name) => `scuttlepay_${name}`);

// ============================================================================
// NextAuth tables
// ============================================================================

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({ mode: "date", withTimezone: true })
    .$defaultFn(() => new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  apiKeys: many(apiKeys),
  wallets: many(wallets),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d
      .varchar({ length: 255 })
      .$type<AdapterAccountType>()
      .notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ============================================================================
// ScuttlePay domain tables
// ============================================================================

export const apiKeys = createTable(
  "api_key",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    keyHash: d.text().notNull(),
    keyPrefix: d.varchar({ length: 12 }).notNull(),
    name: d.varchar({ length: 255 }).notNull(),
    isActive: d.boolean().notNull().default(true),
    lastUsedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("api_key_prefix_active_idx").on(t.keyPrefix, t.isActive),
  ],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

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
      .references(() => users.id),
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
  (t) => [
    index("wallet_user_active_idx").on(t.userId, t.isActive),
  ],
);

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  spendingPolicies: many(spendingPolicies),
  transactions: many(transactions),
  orders: many(orders),
}));

export const spendingPolicies = createTable("spending_policy", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  walletId: d
    .varchar({ length: 255 })
    .notNull()
    .references(() => wallets.id),
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
}));

export const spendingPoliciesRelations = relations(
  spendingPolicies,
  ({ one }) => ({
    wallet: one(wallets, {
      fields: [spendingPolicies.walletId],
      references: [wallets.id],
    }),
  }),
);

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
      .references(() => wallets.id),
    type: d
      .varchar({ length: 20 })
      .notNull()
      .$type<"purchase" | "fund" | "refund">(),
    status: d
      .varchar({ length: 20 })
      .notNull()
      .$type<"pending" | "settling" | "settled" | "failed">(),
    amountUsdc: d.numeric({ precision: 20, scale: 6 }).notNull(),
    txHash: d.text(),
    merchantAddress: d.text().notNull(),
    productId: d.text().notNull(),
    productName: d.text().notNull(),
    storeUrl: d.text().notNull(),
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
  ],
);

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    wallet: one(wallets, {
      fields: [transactions.walletId],
      references: [wallets.id],
    }),
    orders: many(orders),
  }),
);

export const orders = createTable("order", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  transactionId: d
    .varchar({ length: 255 })
    .notNull()
    .unique()
    .references(() => transactions.id),
  walletId: d
    .varchar({ length: 255 })
    .notNull()
    .references(() => wallets.id),
  shopifyOrderId: d.text(),
  shopifyOrderNumber: d.text(),
  status: d
    .varchar({ length: 20 })
    .notNull()
    .$type<"created" | "confirmed" | "failed">(),
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
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  transaction: one(transactions, {
    fields: [orders.transactionId],
    references: [transactions.id],
  }),
  wallet: one(wallets, {
    fields: [orders.walletId],
    references: [wallets.id],
  }),
}));
