import { env } from "~/env";

const STOREFRONT_API_VERSION = "2024-10";
const ADMIN_API_VERSION = "2024-01";

// ---------------------------------------------------------------------------
// Storefront API (GraphQL)
// ---------------------------------------------------------------------------

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>;
}

function getStorefrontUrl(): string {
  const storeUrl = env.SHOPIFY_STORE_URL;
  if (!storeUrl) {
    throw new Error("SHOPIFY_STORE_URL is not configured");
  }
  return `${storeUrl}/api/${STOREFRONT_API_VERSION}/graphql.json`;
}

function getStorefrontToken(): string {
  const token = env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
  if (!token) {
    throw new Error("SHOPIFY_STOREFRONT_PUBLIC_TOKEN is not configured");
  }
  return token;
}

export async function storefrontQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(getStorefrontUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": getStorefrontToken(),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Shopify Storefront API error: ${response.status.toString()} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Shopify GraphQL error: ${message}`);
  }

  if (!json.data) {
    throw new Error("Shopify returned empty data");
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Admin API (REST)
// ---------------------------------------------------------------------------

function getAdminBaseUrl(): string {
  const storeUrl = env.SHOPIFY_STORE_URL;
  if (!storeUrl) {
    throw new Error("SHOPIFY_STORE_URL is not configured");
  }
  return `${storeUrl}/admin/api/${ADMIN_API_VERSION}`;
}

function getAdminToken(): string {
  const token = env.SHOPIFY_ADMIN_TOKEN;
  if (!token) {
    throw new Error("SHOPIFY_ADMIN_TOKEN is not configured");
  }
  return token;
}

export interface AdminApiResponse<T> {
  data: T;
}

export class ShopifyAdminApiError extends Error {
  readonly statusCode: number;
  readonly retryAfterMs: number | undefined;

  constructor(statusCode: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "ShopifyAdminApiError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function adminRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<AdminApiResponse<T>> {
  const url = `${getAdminBaseUrl()}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": getAdminToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? parseFloat(retryAfter) * 1000 : 2000;
    throw new ShopifyAdminApiError(
      429,
      "Shopify Admin API rate limited",
      retryAfterMs,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new ShopifyAdminApiError(
      response.status,
      `Shopify Admin API error: ${response.status.toString()} ${text}`,
    );
  }

  const data = (await response.json()) as T;
  return { data };
}
