import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { transactionListParamsSchema, transactionSchema } from "@scuttlepay/shared";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { db } from "~/server/db";
import { transactions } from "~/server/db/schema/transaction";

function requireWalletId(walletId: string | null): string {
  if (!walletId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No active wallet found",
    });
  }
  return walletId;
}

function serializeTransaction(row: typeof transactions.$inferSelect) {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    status: row.status,
    amountUsdc: row.amountUsdc,
    txHash: row.txHash,
    merchantAddress: row.merchantAddress,
    productId: row.productId,
    productName: row.productName,
    storeUrl: row.storeUrl,
    errorMessage: row.errorMessage,
    initiatedAt: row.initiatedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const transactionListOutputSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().nullable(),
});

const transactionDetailOutputSchema = transactionSchema.extend({
  metadata: z.record(z.unknown()).nullable(),
  order: z
    .object({
      id: z.string(),
      shopifyOrderId: z.string().nullable(),
      shopifyOrderNumber: z.string().nullable(),
      status: z.string(),
      productId: z.string(),
      productName: z.string(),
      variantId: z.string().nullable(),
      quantity: z.number(),
      unitPriceUsdc: z.string(),
      totalUsdc: z.string(),
      storeUrl: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
});

export const transactionRouter = createTRPCRouter({
  list: authedProcedure
    .input(transactionListParamsSchema)
    .output(transactionListOutputSchema)
    .query(async ({ ctx, input }) => {
      const walletId = requireWalletId(ctx.walletId);
      const { limit, cursor } = input;

      const conditions = [eq(transactions.walletId, walletId)];
      if (cursor) {
        conditions.push(lt(transactions.createdAt, new Date(cursor)));
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const lastItem = items[items.length - 1];

      return {
        items: items.map(serializeTransaction),
        nextCursor: hasMore && lastItem ? lastItem.createdAt.toISOString() : null,
      };
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(transactionDetailOutputSchema)
    .query(async ({ ctx, input }) => {
      const walletId = requireWalletId(ctx.walletId);

      const row = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.walletId, walletId),
        ),
        with: { orders: true },
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const linkedOrder = row.orders[0] ?? null;

      return {
        ...serializeTransaction(row),
        metadata: row.metadata ?? null,
        order: linkedOrder
          ? {
              id: linkedOrder.id,
              shopifyOrderId: linkedOrder.shopifyOrderId,
              shopifyOrderNumber: linkedOrder.shopifyOrderNumber,
              status: linkedOrder.status,
              productId: linkedOrder.productId,
              productName: linkedOrder.productName,
              variantId: linkedOrder.variantId,
              quantity: linkedOrder.quantity,
              unitPriceUsdc: linkedOrder.unitPriceUsdc,
              totalUsdc: linkedOrder.totalUsdc,
              storeUrl: linkedOrder.storeUrl,
              createdAt: linkedOrder.createdAt.toISOString(),
            }
          : null,
      };
    }),
});
