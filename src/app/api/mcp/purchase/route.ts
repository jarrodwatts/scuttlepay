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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Request body is not valid JSON",
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

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
    merchantId: parsed.data.merchantId,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    quantity: parsed.data.quantity,
    customerEmail: parsed.data.customerEmail,
    customerFirstName: parsed.data.customerFirstName,
    customerLastName: parsed.data.customerLastName,
    shippingAddress: parsed.data.shippingAddress,
  });

  return NextResponse.json({ data: result });
});
