import { relations } from "drizzle-orm";
import { users } from "./auth";
import { apiKeys } from "./api-key";
import { wallets, spendingPolicies } from "./wallet";
import { transactions, orders } from "./transaction";
import { merchants } from "./merchant";

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  wallets: many(wallets),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  spendingPolicy: one(spendingPolicies, {
    fields: [apiKeys.id],
    references: [spendingPolicies.apiKeyId],
  }),
  transactions: many(transactions),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  spendingPolicies: many(spendingPolicies),
  transactions: many(transactions),
  orders: many(orders),
}));

export const spendingPoliciesRelations = relations(
  spendingPolicies,
  ({ one }) => ({
    wallet: one(wallets, {
      fields: [spendingPolicies.walletId],
      references: [wallets.id],
    }),
    apiKey: one(apiKeys, {
      fields: [spendingPolicies.apiKeyId],
      references: [apiKeys.id],
    }),
  }),
);

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    wallet: one(wallets, {
      fields: [transactions.walletId],
      references: [wallets.id],
    }),
    apiKey: one(apiKeys, {
      fields: [transactions.apiKeyId],
      references: [apiKeys.id],
    }),
    merchant: one(merchants, {
      fields: [transactions.merchantId],
      references: [merchants.id],
    }),
    orders: many(orders),
  }),
);

export const ordersRelations = relations(orders, ({ one }) => ({
  transaction: one(transactions, {
    fields: [orders.transactionId],
    references: [transactions.id],
  }),
  wallet: one(wallets, {
    fields: [orders.walletId],
    references: [wallets.id],
  }),
  merchant: one(merchants, {
    fields: [orders.merchantId],
    references: [merchants.id],
  }),
}));

export const merchantsRelations = relations(merchants, ({ many }) => ({
  transactions: many(transactions),
  orders: many(orders),
}));
