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

  await upsertMerchant(domain, access_token, storefrontToken, scope);

  const apiKey = env.SHOPIFY_APP_API_KEY;
  if (apiKey) {
    return NextResponse.redirect(`https://${domain}/admin/apps/${apiKey}`);
  }

  const successUrl = new URL("/merchant/installed", req.nextUrl.origin);
  successUrl.searchParams.set("shop", domain);
  return NextResponse.redirect(successUrl.toString());
}
