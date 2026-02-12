import {
  ErrorCode,
  ScuttlePayError,
  TransactionStatus,
  TransactionType,
  OrderStatus,
  type PurchaseResult,
  type ProductDetail,
} from "@scuttlepay/shared";

import { db } from "~/server/db";
import { transactions, orders } from "~/server/db/schema/transaction";
import { env } from "~/env";
import { eq } from "drizzle-orm";
import * as shopifyService from "./shopify.service";
import * as walletService from "./wallet.service";
import * as spendingService from "./spending.service";
import * as paymentService from "./payment.service";

interface PurchaseParams {
  walletId: string;
  productId: string;
  variantId?: string;
  quantity?: number;
}

function getMerchantAddress(): string {
  const addr = env.MERCHANT_ADDRESS;
  if (!addr) {
    throw new ScuttlePayError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "MERCHANT_ADDRESS is not configured",
    });
  }
  return addr;
}

function getStoreUrl(): string {
  const url = env.SHOPIFY_STORE_URL;
  if (!url) {
    throw new ScuttlePayError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "SHOPIFY_STORE_URL is not configured",
    });
  }
  return url;
}

function resolvePrice(
  product: ProductDetail,
  variantId: string | undefined,
  quantity: number,
): { unitPrice: string; totalUsdc: string } {
  let unitPrice = product.priceUsdc;

  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new ScuttlePayError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Variant ${variantId} not found on product ${product.id}`,
        metadata: { productId: product.id, variantId },
      });
    }
    unitPrice = variant.priceUsdc;
  }

  const total = (Number(unitPrice) * quantity).toFixed(6);
  return { unitPrice, totalUsdc: total };
}

export async function purchase(
  params: PurchaseParams,
): Promise<PurchaseResult> {
  const { walletId, productId, variantId, quantity = 1 } = params;
  const merchantAddress = getMerchantAddress();
  const storeUrl = getStoreUrl();

  // Step 1: Get product details
  const product = await shopifyService.getProduct(productId);
  const { unitPrice, totalUsdc } = resolvePrice(product, variantId, quantity);

  // Step 2: Check balance
  const balance = await walletService.getBalance(walletId);
  if (Number(balance) < Number(totalUsdc)) {
    throw new ScuttlePayError({
      code: ErrorCode.INSUFFICIENT_BALANCE,
      message: `Insufficient balance: have ${balance}, need ${totalUsdc}`,
      metadata: { available: balance, required: totalUsdc },
    });
  }

  // Step 3: Evaluate spending limits
  const evaluation = await spendingService.evaluate(walletId, totalUsdc);
  if (!evaluation.allowed) {
    const denial = evaluation.denial;
    throw new ScuttlePayError({
      code: ErrorCode.SPENDING_LIMIT_EXCEEDED,
      message: `Spending limit exceeded: ${denial?.code ?? "unknown"}`,
      metadata: {
        period: denial?.code === "DAILY_LIMIT_EXCEEDED" ? "daily" : "per-transaction",
        limit: denial?.limit,
        spent: denial?.current,
        requested: denial?.requested,
      },
    });
  }

  // Step 4: Insert pending transaction
  const [txRow] = await db
    .insert(transactions)
    .values({
      walletId,
      type: TransactionType.PURCHASE,
      status: TransactionStatus.PENDING,
      amountUsdc: totalUsdc,
      merchantAddress,
      productId,
      productName: product.title,
      storeUrl,
    })
    .returning();

  if (!txRow) {
    throw new ScuttlePayError({
      code: ErrorCode.DATABASE_ERROR,
      message: "Failed to create transaction row",
    });
  }

  // Step 5: Sign and settle payment
  let settlement: paymentService.SettlementResult;
  try {
    settlement = await paymentService.signAndSettle(
      walletId,
      totalUsdc,
      merchantAddress,
    );
  } catch (err) {
    await db
      .update(transactions)
      .set({
        status: TransactionStatus.FAILED,
        errorMessage:
          err instanceof Error ? err.message : "Payment failed",
      })
      .where(eq(transactions.id, txRow.id));

    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: err instanceof Error ? err.message : "Payment failed",
      metadata: { transactionId: txRow.id },
      cause: err,
    });
  }

  // Step 6: Update transaction to settled
  await db
    .update(transactions)
    .set({
      status: TransactionStatus.SETTLED,
      txHash: settlement.txHash,
      settledAt: settlement.settledAt,
    })
    .where(eq(transactions.id, txRow.id));

  // Step 7: Create Shopify order (non-fatal)
  let shopifyOrderId: string | null = null;
  let orderNumber: string | null = null;
  let orderStatus: OrderStatus = OrderStatus.CREATED;
  let orderError: string | null = null;

  const walletAddress = await walletService.getAddress(walletId);

  try {
    const orderResult = await shopifyService.createOrder({
      productTitle: product.title,
      variantId,
      quantity,
      priceUsdc: unitPrice,
      txHash: settlement.txHash,
      walletAddress,
    });
    shopifyOrderId = String(orderResult.shopifyOrderId);
    orderNumber = orderResult.orderNumber;
  } catch (err) {
    orderStatus = OrderStatus.FAILED;
    orderError = err instanceof Error ? err.message : "Order creation failed";
    console.error("[purchase] Order creation failed (non-fatal)", {
      transactionId: txRow.id,
      txHash: settlement.txHash,
      error: orderError,
    });
  }

  // Step 8: Insert order row
  await db.insert(orders).values({
    transactionId: txRow.id,
    walletId,
    shopifyOrderId,
    shopifyOrderNumber: orderNumber,
    status: orderStatus,
    productId,
    productName: product.title,
    variantId: variantId ?? null,
    quantity,
    unitPriceUsdc: unitPrice,
    totalUsdc,
    storeUrl,
    errorMessage: orderError,
  });

  // Step 9: Return result
  return {
    transactionId: txRow.id,
    txHash: settlement.txHash,
    orderId: shopifyOrderId,
    orderNumber,
    product: {
      id: product.id,
      name: product.title,
      variantId: variantId ?? null,
    },
    amount: totalUsdc,
    status: TransactionStatus.SETTLED,
  };
}
