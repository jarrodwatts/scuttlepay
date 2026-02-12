import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";

export const POST = withApiKey(async (req: NextRequest, _ctx) => {
  const body = (await req.json()) as Record<string, unknown>;
  const productId = body.productId;

  if (typeof productId !== "string" || productId.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Missing required field 'productId'" } },
      { status: 400 },
    );
  }

  // TODO: Integrate with purchase service in Task 3.x
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Purchase endpoint not yet connected to payment service",
      },
    },
    { status: 501 },
  );
});
