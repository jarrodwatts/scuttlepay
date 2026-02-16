import { NextResponse, type NextRequest } from "next/server";
import { eq, count, sum } from "drizzle-orm";

import { withSessionToken } from "~/app/api/merchant/_middleware";
import { db } from "~/server/db";
import { orders } from "~/server/db/schema";
import { searchProducts } from "~/server/services/shopify.service";

export const GET = withSessionToken(async (_req: NextRequest, ctx) => {
  const [orderStats] = await db
    .select({
      totalOrders: count(),
      totalRevenue: sum(orders.totalUsdc),
    })
    .from(orders)
    .where(eq(orders.merchantId, ctx.merchantId));

  let productCount = 0;
  try {
    const products = await searchProducts(ctx.merchantId, "", 50);
    productCount = products.length;
  } catch {
    // Non-fatal — storefront may be temporarily unavailable
  }

  return NextResponse.json({
    data: {
      totalOrders: orderStats?.totalOrders ?? 0,
      totalRevenue: orderStats?.totalRevenue ?? "0.000000",
      productCount,
    },
  });
});
