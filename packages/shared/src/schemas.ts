import { z } from "zod";
import { TransactionStatus, TransactionType } from "./types.js";

export const usdcAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount: up to 6 decimal places");

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const purchaseRequestSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
});
export type PurchaseRequest = z.infer<typeof purchaseRequestSchema>;

export const productSearchParamsSchema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type ProductSearchParams = z.infer<typeof productSearchParamsSchema>;

export const transactionListParamsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});
export type TransactionListParams = z.infer<typeof transactionListParamsSchema>;

export const walletBalanceSchema = z.object({
  balance: usdcAmountSchema,
  currency: z.literal("USDC"),
  chain: z.string(),
});

export const productVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  priceUsdc: usdcAmountSchema,
});

export const productSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priceUsdc: usdcAmountSchema,
  imageUrl: z.string().nullable(),
});

export const productDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priceUsdc: usdcAmountSchema,
  images: z.array(z.string()),
  variants: z.array(productVariantSchema),
});

export const transactionSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  type: z.nativeEnum(TransactionType),
  status: z.nativeEnum(TransactionStatus),
  amountUsdc: usdcAmountSchema,
  txHash: z.string().nullable(),
  merchantAddress: z.string(),
  productId: z.string(),
  productName: z.string(),
  storeUrl: z.string(),
  errorMessage: z.string().nullable(),
  initiatedAt: z.string(),
  settledAt: z.string().nullable(),
  createdAt: z.string(),
});

export const purchaseResultSchema = z.object({
  transactionId: z.string(),
  txHash: z.string(),
  orderId: z.string().nullable(),
  orderNumber: z.string().nullable(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    variantId: z.string().nullable(),
  }),
  amount: usdcAmountSchema,
  status: z.nativeEnum(TransactionStatus),
});
