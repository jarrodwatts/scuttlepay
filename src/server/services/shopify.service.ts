import {
  ErrorCode,
  ScuttlePayError,
  type ProductSearchResult,
  type ProductDetail,
} from "@scuttlepay/shared";

import {
  storefrontQuery,
  adminRequest,
  ShopifyAdminApiError,
} from "~/server/lib/shopify";

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) return undefined;
  return entry.data;
}

function getStale<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return entry?.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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
  const amount = parseFloat(money.amount);
  return amount.toFixed(6);
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
  query: string,
  first = 10,
): Promise<ProductSearchResult[]> {
  const cacheKey = `search:${query}:${String(first)}`;

  const cached = getCached<ProductSearchResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await storefrontQuery<SearchProductsResponse>(
      SEARCH_PRODUCTS_QUERY,
      { query, first },
    );

    const results = data.products.edges.map((e) => mapProductNode(e.node));
    setCache(cacheKey, results);
    return results;
  } catch (err) {
    const stale = getStale<ProductSearchResult[]>(cacheKey);
    if (stale) return stale;
    throw err;
  }
}

export async function getProduct(productId: string): Promise<ProductDetail> {
  const cacheKey = `product:${productId}`;

  const cached = getCached<ProductDetail>(cacheKey);
  if (cached) return cached;

  try {
    const data = await storefrontQuery<GetProductResponse>(GET_PRODUCT_QUERY, {
      id: productId,
    });

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
    if (stale) return stale;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Order creation (Admin REST API)
// ---------------------------------------------------------------------------

interface ShopifyDraftOrderLineItem {
  variant_id?: number;
  title?: string;
  quantity: number;
  price?: string;
}

interface ShopifyDraftOrderResponse {
  draft_order: {
    id: number;
    order_id: number | null;
    name: string;
    status: string;
  };
}

export interface CreateOrderParams {
  productTitle: string;
  variantId?: string;
  quantity: number;
  priceUsdc: string;
  txHash: string;
  walletAddress: string;
  customerEmail?: string;
}

export interface CreateOrderResult {
  shopifyOrderId: number;
  orderNumber: string;
}

function extractNumericId(gid: string): number {
  const match = /\/(\d+)$/.exec(gid);
  if (!match?.[1]) {
    throw new Error(`Cannot extract numeric ID from: ${gid}`);
  }
  return parseInt(match[1], 10);
}

async function adminCreateDraftOrder(
  params: CreateOrderParams,
): Promise<ShopifyDraftOrderResponse> {
  const lineItem: ShopifyDraftOrderLineItem = {
    quantity: params.quantity,
  };

  if (params.variantId) {
    lineItem.variant_id = extractNumericId(params.variantId);
  } else {
    lineItem.title = params.productTitle;
    lineItem.price = params.priceUsdc;
  }

  const draftOrder: Record<string, unknown> = {
    line_items: [lineItem],
    note: `Paid via ScuttlePay x402 | tx: ${params.txHash} | wallet: ${params.walletAddress}`,
    tags: "scuttlepay, x402",
  };

  if (params.customerEmail) {
    draftOrder.email = params.customerEmail;
  }

  const { data } = await adminRequest<ShopifyDraftOrderResponse>(
    "POST",
    "/draft_orders.json",
    { draft_order: draftOrder },
  );

  return data;
}

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  try {
    const response = await adminCreateDraftOrder(params);

    return {
      shopifyOrderId: response.draft_order.id,
      orderNumber: response.draft_order.name,
    };
  } catch (err) {
    if (err instanceof ShopifyAdminApiError && err.statusCode === 429) {
      console.error("[createOrder] Rate limited, retrying once", { txHash: params.txHash, retryAfterMs: err.retryAfterMs });
      await new Promise((r) => setTimeout(r, err.retryAfterMs ?? 2000));
      try {
        const response = await adminCreateDraftOrder(params);
        return {
          shopifyOrderId: response.draft_order.id,
          orderNumber: response.draft_order.name,
        };
      } catch (retryErr) {
        console.error("[createOrder] Failed after retry", retryErr);
        throw new ScuttlePayError({
          code: ErrorCode.ORDER_CREATION_FAILED,
          message: `Order creation failed after retry: ${retryErr instanceof Error ? retryErr.message : "unknown error"}`,
          metadata: { txHash: params.txHash },
          cause: retryErr,
        });
      }
    }

    console.error("[createOrder] Failed", err);
    throw new ScuttlePayError({
      code: ErrorCode.ORDER_CREATION_FAILED,
      message: `Order creation failed: ${err instanceof Error ? err.message : "unknown error"}`,
      metadata: { txHash: params.txHash },
      cause: err,
    });
  }
}
