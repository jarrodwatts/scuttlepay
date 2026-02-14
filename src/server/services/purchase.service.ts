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
import { compareUsdc, multiplyUsdc } from "~/server/lib/usdc-math";

interface PurchaseParams {
  walletId: string;
  apiKeyId: string;
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

  const total = multiplyUsdc(unitPrice, quantity);
  return { unitPrice, totalUsdc: total };
}

export async function purchase(
  params: PurchaseParams,
): Promise<PurchaseResult> {
  const { walletId, apiKeyId, productId, variantId, quantity = 1 } = params;
  const merchantAddress = getMerchantAddress();
  const storeUrl = getStoreUrl();

  const product = await shopifyService.getProduct(productId);
  const { unitPrice, totalUsdc } = resolvePrice(product, variantId, quantity);

  // Serializable transaction: spending eval + pending tx insert.
  // The DB isolation prevents concurrent purchases from exceeding spending limits.
  // NOTE: The on-chain balance check is a best-effort pre-check only — it reads
  // from an external RPC and is NOT covered by the DB transaction's isolation.
  const txRow = await db.transaction(
    async (tx) => {
      const balance = await walletService.getBalance(walletId);
      if (compareUsdc(balance, totalUsdc) < 0) {
        throw new ScuttlePayError({
          code: ErrorCode.INSUFFICIENT_BALANCE,
          message: `Insufficient balance: have ${balance}, need ${totalUsdc}`,
          metadata: { available: balance, required: totalUsdc },
        });
      }

      const evaluation = await spendingService.evaluate(apiKeyId, totalUsdc, tx);
      if (!evaluation.allowed) {
        const { denial } = evaluation;
        throw new ScuttlePayError({
          code: ErrorCode.SPENDING_LIMIT_EXCEEDED,
          message: `Spending limit exceeded: ${denial.code}`,
          metadata: {
            period: denial.code === "DAILY_LIMIT_EXCEEDED" ? "daily" : "per-transaction",
            limit: denial.limit,
            spent: denial.current,
            requested: denial.requested,
          },
        });
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          walletId,
          apiKeyId,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.PENDING,
          amountUsdc: totalUsdc,
          merchantAddress,
          productId,
          productName: product.title,
          storeUrl,
        })
        .returning();

      if (!row) {
        throw new ScuttlePayError({
          code: ErrorCode.DATABASE_ERROR,
          message: "Failed to create transaction row",
        });
      }

      return row;
    },
    { isolationLevel: "serializable" },
  );

  // Payment settlement (outside the serializable tx — it's an external call)
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

  // Update transaction to settled
  await db
    .update(transactions)
    .set({
      status: TransactionStatus.SETTLED,
      txHash: settlement.txHash,
      settledAt: settlement.settledAt,
    })
    .where(eq(transactions.id, txRow.id));

  // Create Shopify order (non-fatal)
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
