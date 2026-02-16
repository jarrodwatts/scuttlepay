import {
  ErrorCode,
  ScuttlePayError,
  TransactionStatus,
  TransactionType,
  OrderStatus,
  type PurchaseResult,
  type ProductDetail,
  type PurchaseRequest,
} from "@scuttlepay/shared";

import { db } from "~/server/db";
import { transactions, orders } from "~/server/db/schema/transaction";
import { eq } from "drizzle-orm";
import * as shopifyService from "./shopify.service";
import * as merchantService from "./merchant.service";
import * as walletService from "./wallet.service";
import * as spendingService from "./spending.service";
import * as paymentService from "./payment.service";
import { compareUsdc, multiplyUsdc } from "~/server/lib/usdc-math";

type PurchaseParams = PurchaseRequest & {
  walletId: string;
  apiKeyId: string;
};

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
  const { walletId, apiKeyId, merchantId, productId, variantId, quantity = 1 } = params;

  const merchant = await merchantService.getActiveMerchantById(merchantId);
  if (!merchant) {
    throw new ScuttlePayError({
      code: ErrorCode.NOT_FOUND,
      message: `Merchant ${merchantId} not found or inactive`,
      metadata: { merchantId },
    });
  }

  if (!merchant.stripeAccountId) {
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: "Merchant has not completed Stripe onboarding",
      metadata: { merchantId },
    });
  }

  const storeUrl = `https://${merchant.shopDomain}`;
  const product = await shopifyService.getProduct(merchantId, productId);
  const { unitPrice, totalUsdc } = resolvePrice(product, variantId, quantity);

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
          merchantId,
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

  let settlement: paymentService.SettlementResult;
  try {
    settlement = await paymentService.settleWithStripe(
      walletId,
      totalUsdc,
      merchant.stripeAccountId,
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

  try {
    await db
      .update(transactions)
      .set({
        status: TransactionStatus.SETTLED,
        txHash: settlement.txHash,
        settledAt: settlement.settledAt,
      })
      .where(eq(transactions.id, txRow.id));
  } catch (err) {
    console.error("[purchase] Failed to update transaction to SETTLED", {
      transactionId: txRow.id,
      txHash: settlement.txHash,
      stripePaymentIntentId: settlement.stripePaymentIntentId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  let shopifyOrderId: string | null = null;
  let orderNumber: string | null = null;
  let orderStatus: OrderStatus = OrderStatus.CREATED;
  let orderError: string | null = null;

  try {
    const orderResult = await shopifyService.createOrder({
      merchantId,
      productTitle: product.title,
      variantId,
      quantity,
      priceUsdc: unitPrice,
      totalUsdc,
      stripePaymentIntentId: settlement.stripePaymentIntentId,
      customerEmail: params.customerEmail,
      customerFirstName: params.customerFirstName,
      customerLastName: params.customerLastName,
      shippingAddress: params.shippingAddress,
    });
    shopifyOrderId = orderResult.shopifyOrderId;
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

  try {
    await db.insert(orders).values({
      transactionId: txRow.id,
      walletId,
      shopifyOrderId,
      shopifyOrderNumber: orderNumber,
      status: orderStatus,
      merchantId,
      productId,
      productName: product.title,
      variantId: variantId ?? null,
      quantity,
      unitPriceUsdc: unitPrice,
      totalUsdc,
      storeUrl,
      errorMessage: orderError,
    });
  } catch (err) {
    console.error("[purchase] Failed to insert order record", {
      transactionId: txRow.id,
      txHash: settlement.txHash,
      shopifyOrderId,
      orderNumber,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

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
