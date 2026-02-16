import { NextResponse, type NextRequest } from "next/server";

import { withSessionToken } from "~/app/api/merchant/_middleware";
import { searchProducts } from "~/server/services/shopify.service";

export const GET = withSessionToken(async (_req: NextRequest, ctx) => {
  const products = await searchProducts(ctx.merchantId, "", 50);
  return NextResponse.json({ data: products, count: products.length });
});
