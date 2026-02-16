import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";
import { ErrorCode, ScuttlePayError, toApiResponse } from "@scuttlepay/shared";
import { searchProducts, getProduct } from "~/server/services/shopify.service";

export const GET = withApiKey(async (req: NextRequest, _ctx) => {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get("merchantId");
  const query = searchParams.get("q");
  const productId = searchParams.get("id");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  if (!merchantId) {
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Missing required 'merchantId' query parameter",
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

  if (productId) {
    const product = await getProduct(merchantId, productId);
    return NextResponse.json({ data: product });
  }

  if (!query) {
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Missing search query parameter 'q' or product 'id'",
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

  const results = await searchProducts(merchantId, query, limit);
  return NextResponse.json({ data: results });
});
