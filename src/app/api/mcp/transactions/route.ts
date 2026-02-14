import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "~/server/db";
import { transactions } from "~/server/db/schema/transaction";
import { apiKeys } from "~/server/db/schema/api-key";
import { withApiKey } from "~/app/api/mcp/_middleware";
import { serializeTransaction } from "~/server/lib/serialize-transaction";

export const GET = withApiKey(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const cursor = searchParams.get("cursor");

  const conditions = [eq(transactions.walletId, ctx.walletId)];
  if (cursor) {
    conditions.push(lt(transactions.createdAt, new Date(cursor)));
  }

  const rows = await db
    .select({
      transaction: transactions,
      agentName: apiKeys.name,
    })
    .from(transactions)
    .leftJoin(apiKeys, eq(transactions.apiKeyId, apiKeys.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];

  return NextResponse.json({
    data: items.map((r) => serializeTransaction(r.transaction, r.agentName)),
    nextCursor: hasMore && lastItem
      ? lastItem.transaction.createdAt.toISOString()
      : null,
  });
});
