import { relations } from "drizzle-orm";
import { users, accounts, sessions } from "./auth";
import { apiKeys } from "./api-key";
import { wallets, spendingPolicies } from "./wallet";
import { transactions, orders } from "./transaction";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  apiKeys: many(apiKeys),
  wallets: many(wallets),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
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
  }),
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
