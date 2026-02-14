import {
  type ErrorCode,
  ScuttlePayError,
  type ProductSearchResult,
  type ProductDetail,
  type PurchaseResult,
} from "@scuttlepay/shared";
import type { Config } from "./config.js";

interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retriable: boolean;
  };
}

interface WalletInfo {
  id: string;
  address: string;
  chainId: number;
  label: string;
  isActive: boolean;
  balance: string;
  createdAt: string;
}

interface TransactionRow {
  id: string;
  walletId: string;
  type: string;
  status: string;
  amountUsdc: string;
  txHash: string | null;
  merchantAddress: string | null;
  productId: string | null;
  productName: string | null;
  storeUrl: string | null;
  errorMessage: string | null;
  agentName: string | null;
  initiatedAt: string;
  settledAt: string | null;
  createdAt: string;
}

interface TransactionsResponse {
  data: TransactionRow[];
  nextCursor: string | null;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: Config) {
    this.baseUrl = config.apiUrl;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async searchProducts(
    query: string,
    limit = 10,
  ): Promise<ProductSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const { data } = await this.get<{ data: ProductSearchResult[] }>(
      `/api/mcp/products?${params.toString()}`,
    );
    return data;
  }

  async getProduct(id: string): Promise<ProductDetail> {
    const params = new URLSearchParams({ id });
    const { data } = await this.get<{ data: ProductDetail }>(
      `/api/mcp/products?${params.toString()}`,
    );
    return data;
  }

  async purchase(input: {
    productId: string;
    variantId?: string;
    quantity?: number;
  }): Promise<PurchaseResult> {
    const { data } = await this.post<{ data: PurchaseResult }>(
      "/api/mcp/purchase",
      input,
    );
    return data;
  }

  async getWallet(): Promise<WalletInfo> {
    const { data } = await this.get<{ data: WalletInfo }>("/api/mcp/wallet");
    return data;
  }

  async getBalance(): Promise<string> {
    const wallet = await this.getWallet();
    return wallet.balance;
  }

  async getTransactions(
    limit = 20,
    cursor?: string,
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return this.get<TransactionsResponse>(
      `/api/mcp/transactions?${params.toString()}`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: this.headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let parsed: ApiErrorBody | undefined;
      try {
        parsed = JSON.parse(text) as ApiErrorBody;
      } catch {
        // not JSON
      }

      if (parsed?.error) {
        throw new ScuttlePayError({
          code: parsed.error.code,
          message: parsed.error.message,
          retriable: parsed.error.retriable,
        });
      }

      throw new ScuttlePayError({
        code: "INTERNAL_ERROR",
        message: `HTTP ${String(response.status)}: ${text.slice(0, 200)}`,
      });
    }

    return (await response.json()) as T;
  }
}
