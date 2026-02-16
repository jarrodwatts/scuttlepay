import type Stripe from "stripe";
import { Engine } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { getWalletBalance } from "thirdweb/wallets";
import { ErrorCode, ScuttlePayError } from "@scuttlepay/shared";

import {
  activeChain,
  getThirdwebClient,
  getServerWallet,
  getUsdcContract,
} from "~/server/lib/thirdweb";
import { getAddress } from "~/server/services/wallet.service";
import { parseUsdc, isPositiveUsdc, usdcToCents } from "~/server/lib/usdc-math";
import { getStripeClient } from "~/server/lib/stripe";
import { env } from "~/env";

// Stripe crypto/x402 response types (not yet in SDK type definitions)
interface CryptoDepositAddress {
  address: string;
}

interface CryptoDepositDetails {
  deposit_addresses: Record<string, CryptoDepositAddress>;
}

interface CryptoNextAction extends Stripe.PaymentIntent.NextAction {
  crypto_collect_deposit_details?: CryptoDepositDetails;
}

// x402 crypto mode param (not yet in SDK types — remove when stripe-node adds native support)
interface CryptoPaymentIntentCreateParams
  extends Omit<Stripe.PaymentIntentCreateParams, "payment_method_options"> {
  payment_method_options?: Stripe.PaymentIntentCreateParams["payment_method_options"] & {
    crypto?: { mode?: "custom" };
  };
}

const MIN_GAS_WEI = 100_000_000_000_000n; // 0.0001 ETH

export interface SettlementResult {
  paymentReference: string;
  txHash: string;
  settledAt: Date;
}

export async function settleWithStripe(
  walletId: string,
  amountUsdc: string,
  stripeAccountId: string,
): Promise<SettlementResult> {
  if (!stripeAccountId) {
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: "Merchant has no Stripe Connected Account",
    });
  }

  if (!isPositiveUsdc(amountUsdc)) {
    throw new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: `Invalid amount: ${amountUsdc}`,
      metadata: { amountUsdc },
    });
  }

  const fromAddress = await getAddress(walletId);
  const amountCents = usdcToCents(amountUsdc);

  const serverWallet = getServerWallet(fromAddress);

  const gasBalance = await getWalletBalance({
    address: fromAddress,
    client: getThirdwebClient(),
    chain: activeChain,
  });
  if (gasBalance.value < MIN_GAS_WEI) {
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `Insufficient ETH for gas: ${gasBalance.displayValue} ETH`,
      metadata: { gasBalance: gasBalance.displayValue },
    });
  }

  const stripe = getStripeClient();
  const createParams: CryptoPaymentIntentCreateParams = {
    amount: amountCents,
    currency: "usd",
    payment_method_types: ["crypto"],
    payment_method_data: { type: "crypto" },
    payment_method_options: {
      crypto: { mode: "custom" },
    },
    confirm: true,
    transfer_data: { destination: stripeAccountId },
  };

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create(
      createParams as Stripe.PaymentIntentCreateParams,
    );
  } catch (err) {
    console.error("[settleWithStripe] Stripe PaymentIntent creation failed", {
      walletId,
      amountUsdc,
      stripeAccountId,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `Stripe PaymentIntent creation failed: ${err instanceof Error ? err.message : "unknown"}`,
      metadata: { walletId, amountUsdc, stripeAccountId },
      cause: err,
    });
  }

  const nextAction = paymentIntent.next_action as CryptoNextAction | null;
  const depositDetails = nextAction?.crypto_collect_deposit_details;
  if (!depositDetails) {
    await stripe.paymentIntents.cancel(paymentIntent.id).catch((cancelErr) => {
      console.error("[settleWithStripe] Failed to cancel orphaned PaymentIntent", {
        paymentIntentId: paymentIntent.id,
        error: cancelErr instanceof Error ? cancelErr.message : "unknown",
      });
    });
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `Stripe did not return crypto deposit details (PI: ${paymentIntent.id})`,
      metadata: { paymentIntentId: paymentIntent.id },
    });
  }

  const networkKey = activeChain.id === 8453 ? "base" : "base-sepolia";
  const depositEntry = depositDetails.deposit_addresses?.[networkKey];
  if (!depositEntry) {
    await stripe.paymentIntents.cancel(paymentIntent.id).catch((cancelErr) => {
      console.error("[settleWithStripe] Failed to cancel PaymentIntent (no deposit address)", {
        paymentIntentId: paymentIntent.id,
        error: cancelErr instanceof Error ? cancelErr.message : "unknown",
      });
    });
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `No deposit address for network ${networkKey} (PI: ${paymentIntent.id})`,
      metadata: { paymentIntentId: paymentIntent.id, networkKey },
    });
  }
  const depositAddress = depositEntry.address;

  const usdcContract = getUsdcContract();
  const valueRaw = parseUsdc(amountUsdc);
  const tx = transfer({
    contract: usdcContract,
    to: depositAddress,
    amountWei: valueRaw,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction: tx,
  });

  console.error("[settleWithStripe] USDC transfer enqueued", {
    transactionId,
    paymentIntentId: paymentIntent.id,
    depositAddress,
    amountUsdc,
    fromAddress,
  });

  let transactionHash: string;
  try {
    const result = await Engine.waitForTransactionHash({
      client: getThirdwebClient(),
      transactionId,
    });
    transactionHash = result.transactionHash;
  } catch (err) {
    console.error("[settleWithStripe] USDC transfer enqueued but hash confirmation failed", {
      transactionId,
      paymentIntentId: paymentIntent.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `USDC transfer enqueued (engineTxId: ${transactionId}, PI: ${paymentIntent.id}) but hash confirmation failed: ${err instanceof Error ? err.message : "unknown"}`,
      retriable: true,
      metadata: { transactionId, paymentIntentId: paymentIntent.id },
      cause: err,
    });
  }

  return {
    paymentReference: paymentIntent.id,
    txHash: transactionHash,
    settledAt: new Date(),
  };
}

export async function settleDirectly(
  walletId: string,
  amountUsdc: string,
): Promise<SettlementResult> {
  const settlementAddress = env.SETTLEMENT_ADDRESS;
  if (!settlementAddress) {
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: "SETTLEMENT_ADDRESS is not configured (required for direct settlement mode)",
    });
  }

  if (!isPositiveUsdc(amountUsdc)) {
    throw new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: `Invalid amount: ${amountUsdc}`,
      metadata: { amountUsdc },
    });
  }

  const fromAddress = await getAddress(walletId);
  const serverWallet = getServerWallet(fromAddress);

  const gasBalance = await getWalletBalance({
    address: fromAddress,
    client: getThirdwebClient(),
    chain: activeChain,
  });
  if (gasBalance.value < MIN_GAS_WEI) {
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `Insufficient ETH for gas: ${gasBalance.displayValue} ETH`,
      metadata: { gasBalance: gasBalance.displayValue },
    });
  }

  const usdcContract = getUsdcContract();
  const valueRaw = parseUsdc(amountUsdc);
  const tx = transfer({
    contract: usdcContract,
    to: settlementAddress,
    amountWei: valueRaw,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction: tx,
  });

  console.error("[settleDirectly] USDC transfer enqueued", {
    transactionId,
    settlementAddress,
    amountUsdc,
    fromAddress,
  });

  let transactionHash: string;
  try {
    const result = await Engine.waitForTransactionHash({
      client: getThirdwebClient(),
      transactionId,
    });
    transactionHash = result.transactionHash;
  } catch (err) {
    console.error("[settleDirectly] USDC transfer enqueued but hash confirmation failed", {
      transactionId,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw new ScuttlePayError({
      code: ErrorCode.PAYMENT_FAILED,
      message: `USDC transfer enqueued (engineTxId: ${transactionId}) but hash confirmation failed: ${err instanceof Error ? err.message : "unknown"}`,
      retriable: true,
      metadata: { transactionId },
      cause: err,
    });
  }

  return {
    paymentReference: transactionHash,
    txHash: transactionHash,
    settledAt: new Date(),
  };
}
