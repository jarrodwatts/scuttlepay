import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "~/server/db";
import { transactions } from "~/server/db/schema/transaction";
import { withApiKey } from "~/app/api/mcp/_middleware";

export const GET = withApiKey(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const cursor = searchParams.get("cursor");

  const conditions = [eq(transactions.walletId, ctx.walletId)];
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
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : null;

  return NextResponse.json({ data, nextCursor });
});
