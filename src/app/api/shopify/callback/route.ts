import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "~/env";
import {
  verifyHmac,
  exchangeCodeForToken,
  createStorefrontAccessToken,
  sanitizeShopDomain,
} from "~/server/lib/shopify-app";
import { upsertMerchant } from "~/server/services/merchant.service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const shop = params.get("shop");
  const code = params.get("code");
  const state = params.get("state");

  if (!shop || !code || !state) {
    return NextResponse.json(
      { error: "Missing required OAuth parameters" },
      { status: 400 },
    );
  }

  const domain = sanitizeShopDomain(shop);
  if (!domain) {
    return NextResponse.json(
      { error: "Invalid shop domain" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const savedNonce = cookieStore.get("shopify_oauth_nonce")?.value;
  if (!savedNonce || savedNonce !== state) {
    return NextResponse.json(
      { error: "Invalid state parameter — possible CSRF" },
      { status: 403 },
    );
  }

  cookieStore.delete("shopify_oauth_nonce");

  const query: Record<string, string> = {};
  params.forEach((value, key) => {
    query[key] = value;
  });

  if (!verifyHmac(query)) {
    return NextResponse.json(
      { error: "Invalid HMAC signature" },
      { status: 403 },
    );
  }

  const { access_token, scope } = await exchangeCodeForToken(domain, code);

  let storefrontToken: string | null = null;
  try {
    storefrontToken = await createStorefrontAccessToken(domain, access_token);
  } catch (err) {
    console.error("[shopify/callback] Failed to create storefront token", err);
  }

  const merchant = await upsertMerchant(
    domain,
    access_token,
    storefrontToken,
    scope,
  );

  if (!merchant.stripeAccountId) {
    const connectState = crypto.randomUUID();

    const stripeUrl = new URL("https://connect.stripe.com/oauth/authorize");
    stripeUrl.searchParams.set("response_type", "code");
    if (!env.STRIPE_CONNECT_CLIENT_ID) {
      return NextResponse.json(
        { error: "STRIPE_CONNECT_CLIENT_ID is not configured" },
        { status: 500 },
      );
    }
    stripeUrl.searchParams.set("client_id", env.STRIPE_CONNECT_CLIENT_ID);
    stripeUrl.searchParams.set("scope", "read_write");
    stripeUrl.searchParams.set(
      "redirect_uri",
      new URL("/api/stripe/connect/callback", req.nextUrl.origin).toString(),
    );
    stripeUrl.searchParams.set("state", `${connectState}:${merchant.id}`);

    cookieStore.set("stripe_connect_state", connectState, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(stripeUrl.toString());
  }

  const apiKey = env.SHOPIFY_APP_API_KEY;
  if (apiKey) {
    return NextResponse.redirect(`https://${domain}/admin/apps/${apiKey}`);
  }

  const successUrl = new URL("/merchant/installed", req.nextUrl.origin);
  successUrl.searchParams.set("shop", domain);
  return NextResponse.redirect(successUrl.toString());
}
