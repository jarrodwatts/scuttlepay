import {
  ErrorCode,
  ScuttlePayError,
  type ProductSearchResult,
  type ProductDetail,
} from "@scuttlepay/shared";

import {
  storefrontQuery,
  adminGraphqlMutation,
  ShopifyAdminApiError,
  type ShopifyCredentials,
} from "~/server/lib/shopify";
import * as merchantService from "./merchant.service";

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function getStale<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return entry?.data;
}

function setCache<T>(key: string, data: T): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function getMerchantCreds(merchantId: string): Promise<ShopifyCredentials> {
  const merchant = await merchantService.getActiveMerchantById(merchantId);
  if (!merchant) {
    throw new ScuttlePayError({
      code: ErrorCode.NOT_FOUND,
      message: `Merchant ${merchantId} not found or inactive`,
      metadata: { merchantId },
    });
  }
  return {
    shopDomain: merchant.shopDomain,
    accessToken: merchant.accessToken,
    storefrontToken: merchant.storefrontToken,
  };
}

// --- Shopify GraphQL response types ---

interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}

interface ShopifyImage {
  url: string;
}

interface ShopifyVariantNode {
  id: string;
  title: string;
  price: ShopifyMoneyV2;
}

interface ShopifyProductNode {
  id: string;
  title: string;
  description: string;
  featuredImage: ShopifyImage | null;
  images?: { edges: Array<{ node: ShopifyImage }> };
  priceRange: {
    minVariantPrice: ShopifyMoneyV2;
  };
  variants: {
    edges: Array<{ node: ShopifyVariantNode }>;
  };
}

interface SearchProductsResponse {
  products: {
    edges: Array<{ node: ShopifyProductNode }>;
  };
}

interface GetProductResponse {
  product: ShopifyProductNode | null;
}

function parseMoneyToUsdc(money: ShopifyMoneyV2): string {
  const parts = money.amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(6, "0").slice(0, 6);
  return `${whole}.${frac}`;
}

const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          featuredImage {
            url
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

const GET_PRODUCT_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      description
      images(first: 10) {
        edges {
          node {
            url
          }
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

function mapProductNode(node: ShopifyProductNode): ProductSearchResult {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    priceUsdc: parseMoneyToUsdc(node.priceRange.minVariantPrice),
    imageUrl: node.featuredImage?.url ?? null,
  };
}

function mapProductDetail(node: ShopifyProductNode): ProductDetail {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    priceUsdc: parseMoneyToUsdc(node.priceRange.minVariantPrice),
    images: node.images?.edges.map((e) => e.node.url) ?? [],
    variants: node.variants.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      priceUsdc: parseMoneyToUsdc(e.node.price),
    })),
  };
}

export async function searchProducts(
  merchantId: string,
  query: string,
  first = 10,
): Promise<ProductSearchResult[]> {
  const cacheKey = `search:${merchantId}:${query}:${String(first)}`;

  const cached = getCached<ProductSearchResult[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMerchantCreds(merchantId);

  try {
    const data = await storefrontQuery<SearchProductsResponse>(
      creds,
      SEARCH_PRODUCTS_QUERY,
      { query, first },
    );

    const results = data.products.edges.map((e) => mapProductNode(e.node));
    setCache(cacheKey, results);
    return results;
  } catch (err) {
    const stale = getStale<ProductSearchResult[]>(cacheKey);
    if (stale) {
      console.error("[shopify] Serving stale search results", {
        cacheKey,
        error: err instanceof Error ? err.message : "unknown",
      });
      return stale;
    }
    throw err;
  }
}

export async function getProduct(
  merchantId: string,
  productId: string,
): Promise<ProductDetail> {
  const cacheKey = `product:${merchantId}:${productId}`;

  const cached = getCached<ProductDetail>(cacheKey);
  if (cached) return cached;

  const creds = await getMerchantCreds(merchantId);

  try {
    const data = await storefrontQuery<GetProductResponse>(
      creds,
      GET_PRODUCT_QUERY,
      { id: productId },
    );

    if (!data.product) {
      throw new ScuttlePayError({
        code: ErrorCode.PRODUCT_NOT_FOUND,
        message: `Product ${productId} not found`,
        metadata: { productId },
      });
    }

    const result = mapProductDetail(data.product);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    if (err instanceof ScuttlePayError) throw err;

    const stale = getStale<ProductDetail>(cacheKey);
    if (stale) {
      console.error("[shopify] Serving stale product data", {
        cacheKey,
        error: err instanceof Error ? err.message : "unknown",
      });
      return stale;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Order creation (Admin GraphQL — orderCreate + Transaction)
// ---------------------------------------------------------------------------

const ORDER_CREATE_MUTATION = `
  mutation orderCreate($order: OrderCreateOrderInput!) {
    orderCreate(order: $order) {
      order {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface OrderCreateResponse {
  orderCreate: {
    order: { id: string; name: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

export interface CreateOrderParams {
  merchantId: string;
  productTitle: string;
  variantId?: string;
  quantity: number;
  priceUsdc: string;
  totalUsdc: string;
  paymentReference: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    provinceCode: string;
    countryCode: string;
    zip: string;
  };
}

export interface CreateOrderResult {
  shopifyOrderId: string;
  orderNumber: string;
}

async function adminCreateOrder(
  creds: ShopifyCredentials,
  params: CreateOrderParams,
): Promise<OrderCreateResponse> {
  const lineItem: Record<string, unknown> = {
    quantity: params.quantity,
    price: params.priceUsdc,
  };

  if (params.variantId) {
    lineItem.variantId = params.variantId;
  } else {
    lineItem.title = params.productTitle;
  }

  const order: Record<string, unknown> = {
    lineItems: [lineItem],
    financialStatus: "PAID",
    currency: "USD",
    transactions: [
      {
        gateway: "ScuttlePay",
        kind: "SALE",
        status: "SUCCESS",
        authorizationCode: params.paymentReference,
        amountSet: {
          shopMoney: {
            amount: params.totalUsdc,
            currencyCode: "USD",
          },
        },
      },
    ],
    sourceName: "scuttlepay",
    tags: ["scuttlepay"],
  };

  if (params.customerEmail) {
    order.customer = {
      email: params.customerEmail,
      firstName: params.customerFirstName,
      lastName: params.customerLastName,
    };
    order.email = params.customerEmail;
  }

  if (params.shippingAddress) {
    order.shippingAddress = {
      address1: params.shippingAddress.address1,
      address2: params.shippingAddress.address2,
      city: params.shippingAddress.city,
      provinceCode: params.shippingAddress.provinceCode,
      countryCodeV2: params.shippingAddress.countryCode,
      zip: params.shippingAddress.zip,
    };
  }

  return adminGraphqlMutation<OrderCreateResponse>(
    creds,
    ORDER_CREATE_MUTATION,
    { order },
  );
}

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const creds = await getMerchantCreds(params.merchantId);

  try {
    const response = await adminCreateOrder(creds, params);

    if (response.orderCreate.userErrors.length > 0) {
      const msg = response.orderCreate.userErrors
        .map((e) => e.message)
        .join("; ");
      throw new ScuttlePayError({
        code: ErrorCode.ORDER_CREATION_FAILED,
        message: `Shopify orderCreate failed: ${msg}`,
        metadata: { paymentReference: params.paymentReference },
      });
    }

    if (!response.orderCreate.order) {
      throw new ScuttlePayError({
        code: ErrorCode.ORDER_CREATION_FAILED,
        message: "Shopify orderCreate returned null order",
        metadata: { paymentReference: params.paymentReference },
      });
    }

    return {
      shopifyOrderId: response.orderCreate.order.id,
      orderNumber: response.orderCreate.order.name,
    };
  } catch (err) {
    if (err instanceof ScuttlePayError) throw err;

    if (err instanceof ShopifyAdminApiError && err.statusCode === 429) {
      await new Promise((r) => setTimeout(r, err.retryAfterMs ?? 2000));
      const retryResponse = await adminCreateOrder(creds, params);

      if (retryResponse.orderCreate.userErrors.length > 0) {
        const retryMsg = retryResponse.orderCreate.userErrors
          .map((e) => e.message)
          .join("; ");
        throw new ScuttlePayError({
          code: ErrorCode.ORDER_CREATION_FAILED,
          message: `Order creation failed after rate-limit retry: ${retryMsg}`,
          metadata: { paymentReference: params.paymentReference },
        });
      }

      if (!retryResponse.orderCreate.order) {
        throw new ScuttlePayError({
          code: ErrorCode.ORDER_CREATION_FAILED,
          message: "Shopify orderCreate returned null order after rate-limit retry",
          metadata: { paymentReference: params.paymentReference },
        });
      }

      return {
        shopifyOrderId: retryResponse.orderCreate.order.id,
        orderNumber: retryResponse.orderCreate.order.name,
      };
    }

    throw new ScuttlePayError({
      code: ErrorCode.ORDER_CREATION_FAILED,
      message: `Order creation failed: ${err instanceof Error ? err.message : "unknown error"}`,
      metadata: { paymentReference: params.paymentReference },
      cause: err,
    });
  }
}
