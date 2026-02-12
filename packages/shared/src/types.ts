export const TransactionType = {
  PURCHASE: "purchase",
  FUND: "fund",
  REFUND: "refund",
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: "pending",
  SETTLING: "settling",
  SETTLED: "settled",
  FAILED: "failed",
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const OrderStatus = {
  CREATED: "created",
  CONFIRMED: "confirmed",
  FAILED: "failed",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

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
  type: TransactionType;
  status: TransactionStatus;
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
  status: OrderStatus;
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

export interface WalletBalance {
  balance: string;
  currency: "USDC";
  chain: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  priceUsdc: string;
}

export interface ProductSearchResult {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  imageUrl: string | null;
}

export interface ProductDetail {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  images: string[];
  variants: ProductVariant[];
}

export interface PurchaseResult {
  transactionId: string;
  txHash: string;
  orderId: string | null;
  orderNumber: string | null;
  product: {
    id: string;
    name: string;
    variantId: string | null;
  };
  amount: string;
  status: TransactionStatus;
}
