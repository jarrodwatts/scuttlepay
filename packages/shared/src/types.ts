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

export type WalletBalance = z.infer<typeof walletBalanceSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;
