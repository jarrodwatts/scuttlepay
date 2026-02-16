const STOREFRONT_API_VERSION = "2024-10";
const ADMIN_API_VERSION = "2026-01";

export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
  storefrontToken?: string | null;
}

// ---------------------------------------------------------------------------
// Storefront API (GraphQL)
// ---------------------------------------------------------------------------

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>;
}

export async function storefrontQuery<T>(
  creds: ShopifyCredentials,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!creds.storefrontToken) {
    throw new Error(
      `No storefront token available for ${creds.shopDomain}`,
    );
  }

  const url = `https://${creds.shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": creds.storefrontToken,
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
  creds: ShopifyCredentials,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<AdminApiResponse<T>> {
  const url = `https://${creds.shopDomain}/admin/api/${ADMIN_API_VERSION}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": creds.accessToken,
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

// ---------------------------------------------------------------------------
// Admin API (GraphQL)
// ---------------------------------------------------------------------------

export async function adminGraphqlMutation<T>(
  creds: ShopifyCredentials,
  mutation: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = `https://${creds.shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": creds.accessToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
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
      `Shopify Admin GraphQL error: ${response.status.toString()} ${text}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new ShopifyAdminApiError(400, `Shopify Admin GraphQL error: ${message}`);
  }

  if (!json.data) {
    throw new ShopifyAdminApiError(500, "Shopify Admin GraphQL returned empty data");
  }

  return json.data;
}
