import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getStripeClient } from "~/server/lib/stripe";
import {
  setStripeAccountId,
  getMerchantById,
} from "~/server/services/merchant.service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing required OAuth parameters" },
      { status: 400 },
    );
  }

  const separatorIndex = state.indexOf(":");
  if (separatorIndex === -1) {
    return NextResponse.json(
      { error: "Malformed state parameter" },
      { status: 400 },
    );
  }

  const nonce = state.slice(0, separatorIndex);
  const merchantId = state.slice(separatorIndex + 1);

  const cookieStore = await cookies();
  const savedNonce = cookieStore.get("stripe_connect_state")?.value;
  if (!savedNonce || savedNonce !== nonce) {
    return NextResponse.json(
      { error: "Invalid state parameter — possible CSRF" },
      { status: 403 },
    );
  }

  cookieStore.delete("stripe_connect_state");

  let stripeAccountId: string;
  try {
    const stripe = getStripeClient();
    const tokenResponse = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    if (!tokenResponse.stripe_user_id) {
      return NextResponse.json(
        { error: "Stripe did not return an account ID" },
        { status: 502 },
      );
    }
    stripeAccountId = tokenResponse.stripe_user_id;
  } catch (err) {
    console.error("[stripe/connect/callback] OAuth token exchange failed", {
      merchantId,
      error: err instanceof Error ? err.message : "unknown",
    });
    const errorUrl = new URL("/merchant/error", req.nextUrl.origin);
    errorUrl.searchParams.set("reason", "stripe_connect_failed");
    return NextResponse.redirect(errorUrl.toString());
  }

  await setStripeAccountId(merchantId, stripeAccountId);

  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { error: "Merchant not found" },
      { status: 404 },
    );
  }

  const successUrl = new URL("/merchant/installed", req.nextUrl.origin);
  successUrl.searchParams.set("shop", merchant.shopDomain);
  return NextResponse.redirect(successUrl.toString());
}
