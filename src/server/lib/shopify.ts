import { env } from "~/env";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>;
}

function getStorefrontUrl(): string {
  const storeUrl = env.SHOPIFY_STORE_URL;
  if (!storeUrl) {
    throw new Error("SHOPIFY_STORE_URL is not configured");
  }
  return `${storeUrl}/api/2024-10/graphql.json`;
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
