import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";
import {
  purchaseRequestSchema,
  ScuttlePayError,
  ErrorCode,
  toApiResponse,
} from "@scuttlepay/shared";
import { purchase } from "~/server/services/purchase.service";

export const POST = withApiKey(async (req: NextRequest, ctx) => {
  const body: unknown = await req.json();
  const parsed = purchaseRequestSchema.safeParse(body);

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: msg,
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

  const result = await purchase({
    walletId: ctx.walletId,
    apiKeyId: ctx.apiKeyId,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    quantity: parsed.data.quantity,
  });

  return NextResponse.json({ data: result });
});
