import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { withSessionToken } from "~/app/api/merchant/_middleware";
import { db } from "~/server/db";
import { orders, transactions } from "~/server/db/schema";

export const GET = withSessionToken(async (_req: NextRequest, ctx) => {
  const rows = await db
    .select({
      id: orders.id,
      productName: orders.productName,
      quantity: orders.quantity,
      totalUsdc: orders.totalUsdc,
      status: orders.status,
      shopifyOrderNumber: orders.shopifyOrderNumber,
      createdAt: orders.createdAt,
      txHash: transactions.txHash,
    })
    .from(orders)
    .leftJoin(transactions, eq(orders.transactionId, transactions.id))
    .where(eq(orders.merchantId, ctx.merchantId))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return NextResponse.json({ data: rows });
});
