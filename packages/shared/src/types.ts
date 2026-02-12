import type { z } from "zod";
import type {
  walletBalanceSchema,
  productVariantSchema,
  productSearchResultSchema,
  productDetailSchema,
  purchaseResultSchema,
} from "./schemas.js";

export type {
  TransactionType,
  TransactionStatus,
  OrderStatus,
} from "./enums.js";

// --- DB row types (internal, use Date) ---

export interface User {
  id: string;
  email: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  chainId: number;
  label: string;
  thirdwebId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface SpendingPolicy {
  id: string;
  walletId: string;
  maxPerTx: string;
  dailyLimit: string;
  monthlyLimit: string | null;
  allowedMerchants: string[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: import("./enums.js").TransactionType;
  status: import("./enums.js").TransactionStatus;
  amountUsdc: string;
  txHash: string | null;
  merchantAddress: string;
  productId: string;
  productName: string;
  storeUrl: string;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  initiatedAt: Date;
  settledAt: Date | null;
  createdAt: Date;
}

export interface Order {
  id: string;
  transactionId: string;
  walletId: string;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;
  status: import("./enums.js").OrderStatus;
  productId: string;
  productName: string;
  variantId: string | null;
  quantity: number;
  unitPriceUsdc: string;
  totalUsdc: string;
  storeUrl: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- API contract types (derived from zod schemas — single source of truth) ---

export type WalletBalance = z.infer<typeof walletBalanceSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;
