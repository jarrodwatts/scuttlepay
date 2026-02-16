import crypto from "node:crypto";
import { env } from "~/env";

const SCOPES = "read_products,write_draft_orders,read_orders";
const ADMIN_API_VERSION = "2024-10";

function requireAppCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = env.SHOPIFY_APP_API_KEY;
  const apiSecret = env.SHOPIFY_APP_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error(
      "SHOPIFY_APP_API_KEY and SHOPIFY_APP_API_SECRET must be configured",
    );
  }
  return { apiKey, apiSecret };
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthUrl(
  shopDomain: string,
  redirectUri: string,
  nonce: string,
): string {
  const { apiKey } = requireAppCredentials();
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyHmac(
  query: Record<string, string>,
): boolean {
  const { apiSecret } = requireAppCredentials();
  const hmac = query.hmac;
  if (!hmac) return false;

  const entries = Object.entries(query)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const computed = crypto
    .createHmac("sha256", apiSecret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(hmac, "hex"),
  );
}

interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string,
): Promise<AccessTokenResponse> {
  const { apiKey, apiSecret } = requireAppCredentials();

  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new Error(
      `Failed to exchange code for token: ${String(response.status)} ${text}`,
    );
  }

  return (await response.json()) as AccessTokenResponse;
}

interface StorefrontTokenResponse {
  data: {
    storefrontAccessTokenCreate: {
      storefrontAccessToken: { accessToken: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
}

export async function createStorefrontAccessToken(
  shopDomain: string,
  adminAccessToken: string,
): Promise<string> {
  const url = `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminAccessToken,
    },
    body: JSON.stringify({
      query: `mutation {
        storefrontAccessTokenCreate(input: { title: "ScuttlePay Storefront" }) {
          storefrontAccessToken { accessToken }
          userErrors { field message }
        }
      }`,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new Error(
      `Failed to create storefront token: ${String(response.status)} ${text}`,
    );
  }

  const json = (await response.json()) as StorefrontTokenResponse;
  const result = json.data.storefrontAccessTokenCreate;

  if (result.userErrors.length > 0) {
    const msg = result.userErrors.map((e) => e.message).join("; ");
    throw new Error(`Storefront token creation failed: ${msg}`);
  }

  if (!result.storefrontAccessToken) {
    throw new Error("Storefront token creation returned null");
  }

  return result.storefrontAccessToken.accessToken;
}

// ---------------------------------------------------------------------------
// Session token verification (App Bridge v4 JWT)
// ---------------------------------------------------------------------------

interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

export interface VerifiedSession {
  shopDomain: string;
  payload: SessionTokenPayload;
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export function verifySessionToken(token: string): VerifiedSession {
  const { apiKey, apiSecret } = requireAppCredentials();

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid session token format");
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const expectedSig = crypto
    .createHmac("sha256", apiSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(signatureB64),
    )
  ) {
    throw new Error("Invalid session token signature");
  }

  const payload = JSON.parse(
    base64UrlDecode(payloadB64).toString("utf-8"),
  ) as SessionTokenPayload;

  if (payload.aud !== apiKey) {
    throw new Error("Session token audience mismatch");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) {
    throw new Error("Session token expired");
  }
  if (payload.nbf > nowSeconds + 60) {
    throw new Error("Session token not yet valid");
  }

  const dest = new URL(payload.dest);
  const shopDomain = dest.hostname;

  return { shopDomain, payload };
}

export function sanitizeShopDomain(shop: string): string | null {
  const cleaned = shop.trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}
