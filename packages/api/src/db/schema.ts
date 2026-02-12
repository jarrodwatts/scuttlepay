import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  wallets: many(wallets),
}));

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  address: text("address").notNull().unique(),
  chainId: integer("chain_id").notNull(),
  label: text("label").notNull().default("default"),
  thirdwebId: text("thirdweb_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  spendingPolicies: many(spendingPolicies),
  transactions: many(transactions),
  orders: many(orders),
}));

export const spendingPolicies = pgTable("spending_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  maxPerTx: numeric("max_per_tx", { precision: 20, scale: 6 }).notNull(),
  dailyLimit: numeric("daily_limit", { precision: 20, scale: 6 }).notNull(),
  monthlyLimit: numeric("monthly_limit", { precision: 20, scale: 6 }),
  allowedMerchants: text("allowed_merchants").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const spendingPoliciesRelations = relations(
  spendingPolicies,
  ({ one }) => ({
    wallet: one(wallets, {
      fields: [spendingPolicies.walletId],
      references: [wallets.id],
    }),
  }),
);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  type: text("type").notNull().$type<"purchase" | "fund" | "refund">(),
  status: text("status")
    .notNull()
    .$type<"pending" | "settling" | "settled" | "failed">(),
  amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }).notNull(),
  txHash: text("tx_hash"),
  merchantAddress: text("merchant_address").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  storeUrl: text("store_url").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  initiatedAt: timestamp("initiated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => transactions.id),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  shopifyOrderId: text("shopify_order_id"),
  shopifyOrderNumber: text("shopify_order_number"),
  status: text("status")
    .notNull()
    .$type<"created" | "confirmed" | "failed">(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  variantId: text("variant_id"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceUsdc: numeric("unit_price_usdc", {
    precision: 20,
    scale: 6,
  }).notNull(),
  totalUsdc: numeric("total_usdc", { precision: 20, scale: 6 }).notNull(),
  storeUrl: text("store_url").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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
