import { NextResponse, type NextRequest } from "next/server";

import { verifySessionToken } from "~/server/lib/shopify-app";
import { getMerchantByShopDomain } from "~/server/services/merchant.service";

export interface MerchantContext {
  merchantId: string;
  shopDomain: string;
}

type RouteHandler = (
  req: NextRequest,
  ctx: MerchantContext,
) => Promise<NextResponse>;

export function withSessionToken(handler: RouteHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.slice(7);

    let shopDomain: string;
    try {
      const session = verifySessionToken(token);
      shopDomain = session.shopDomain;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid session token" },
        { status: 401 },
      );
    }

    const merchant = await getMerchantByShopDomain(shopDomain);
    if (!merchant?.isActive) {
      return NextResponse.json(
        { error: "Merchant not found or inactive" },
        { status: 403 },
      );
    }

    return handler(req, { merchantId: merchant.id, shopDomain });
  };
}
