import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthUrl,
  generateNonce,
  sanitizeShopDomain,
} from "~/server/lib/shopify-app";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const shop = req.nextUrl.searchParams.get("shop");

  if (!shop) {
    return NextResponse.json(
      { error: "Missing 'shop' query parameter" },
      { status: 400 },
    );
  }

  const domain = sanitizeShopDomain(shop);
  if (!domain) {
    return NextResponse.json(
      { error: "Invalid shop domain. Expected format: store-name.myshopify.com" },
      { status: 400 },
    );
  }

  const nonce = generateNonce();
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : req.nextUrl.origin;
  const redirectUri = `${origin}/api/shopify/callback`;

  const cookieStore = await cookies();
  cookieStore.set("shopify_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authUrl = buildAuthUrl(domain, redirectUri, nonce);
  return NextResponse.redirect(authUrl);
}
