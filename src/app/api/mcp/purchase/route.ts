import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";
import { ErrorCode, ScuttlePayError, toApiResponse } from "@scuttlepay/shared";

export const POST = withApiKey(async (req: NextRequest, _ctx) => {
  const body = (await req.json()) as Record<string, unknown>;
  const productId = body.productId;

  if (typeof productId !== "string" || productId.length === 0) {
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Missing required field 'productId'",
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

  const err = new ScuttlePayError({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Purchase endpoint not yet connected to payment service",
  });
  return NextResponse.json(toApiResponse(err), { status: 501 });
});
