import { type Hex } from "thirdweb";
import {
  USDC_ADDRESSES,
  CHAIN_NAMES,
} from "@scuttlepay/shared";

import { env } from "~/env";
import {
  activeChain,
  chainId,
  getServerWallet,
} from "~/server/lib/thirdweb";
import { getAddress } from "~/server/services/wallet.service";
import { parseUsdc, isPositiveUsdc } from "~/server/lib/usdc-math";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type PaymentServiceErrorCode =
  | "PAYMENT_FAILED"
  | "INVALID_ADDRESS"
  | "INVALID_AMOUNT";

export class PaymentServiceError extends Error {
  code: PaymentServiceErrorCode;
  retriable: boolean;

  constructor(
    code: PaymentServiceErrorCode,
    message: string,
    retriable = false,
  ) {
    super(message);
    this.name = "PaymentServiceError";
    this.code = code;
    this.retriable = retriable;
  }
}

// ---------------------------------------------------------------------------
// EIP-712 / EIP-3009 constants
// ---------------------------------------------------------------------------

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

function getUsdcAddress(): Hex {
  const addr = USDC_ADDRESSES[chainId];
  if (!addr) {
    throw new PaymentServiceError(
      "PAYMENT_FAILED",
      `USDC not configured for chain ${String(activeChain.id)}`,
    );
  }
  return addr as Hex;
}

function getChainName(): string {
  const name = CHAIN_NAMES[chainId];
  if (!name) {
    throw new PaymentServiceError(
      "PAYMENT_FAILED",
      `Chain name not configured for chain ${String(activeChain.id)}`,
    );
  }
  return name;
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

// ---------------------------------------------------------------------------
// Facilitator communication
// ---------------------------------------------------------------------------

interface FacilitatorSettleResponse {
  success: boolean;
  error?: string;
  transaction?: string;
  networkId?: string;
}

async function callFacilitatorSettle(
  payload: Record<string, unknown>,
  paymentRequirements: Record<string, unknown>,
): Promise<FacilitatorSettleResponse> {
  const url = `${env.FACILITATOR_URL}/settle`;

  const body = JSON.stringify({
    payload,
    paymentRequirements,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new PaymentServiceError(
        "PAYMENT_FAILED",
        "Facilitator request timed out",
        true,
      );
    }
    throw new PaymentServiceError(
      "PAYMENT_FAILED",
      `Facilitator request failed: ${err instanceof Error ? err.message : "unknown error"}`,
      true,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new PaymentServiceError(
      "PAYMENT_FAILED",
      `Facilitator returned ${String(response.status)}: ${text}`,
      response.status >= 500,
    );
  }

  return (await response.json()) as FacilitatorSettleResponse;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SettlementResult {
  txHash: string;
  settledAt: Date;
}

export async function signAndSettle(
  walletId: string,
  amountUsdc: string,
  payToAddress: string,
): Promise<SettlementResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(payToAddress)) {
    throw new PaymentServiceError(
      "INVALID_ADDRESS",
      `Invalid payTo address: ${payToAddress}`,
    );
  }

  if (!isPositiveUsdc(amountUsdc)) {
    throw new PaymentServiceError(
      "INVALID_AMOUNT",
      `Invalid amount: ${amountUsdc}`,
    );
  }

  const fromAddress = await getAddress(walletId);
  const usdcAddress = getUsdcAddress();
  const chainName = getChainName();
  const valueRaw = parseUsdc(amountUsdc);
  const nonce = randomNonce();
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

  // Sign EIP-712 TransferWithAuthorization
  const serverWallet = getServerWallet(fromAddress);
  const signature = await serverWallet.signTypedData({
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: BigInt(activeChain.id),
      verifyingContract: usdcAddress,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: fromAddress,
      to: payToAddress as Hex,
      value: valueRaw,
      validAfter,
      validBefore,
      nonce,
    },
  });

  const authorization = {
    from: fromAddress,
    to: payToAddress,
    value: valueRaw.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  const payload = {
    x402Version: 1,
    scheme: "exact",
    network: chainName,
    payload: {
      signature,
      authorization,
    },
  };

  const paymentRequirements = {
    scheme: "exact",
    network: chainName,
    maxAmountRequired: valueRaw.toString(),
    resource: "scuttlepay-purchase",
    description: "ScuttlePay purchase settlement",
    payTo: payToAddress,
    maxTimeoutSeconds: 3600,
    asset: usdcAddress,
    extra: {},
  };

  // Attempt settlement with one retry on timeout/5xx
  let result: FacilitatorSettleResponse;
  try {
    result = await callFacilitatorSettle(payload, paymentRequirements);
  } catch (err) {
    if (err instanceof PaymentServiceError && err.retriable) {
      await new Promise((r) => setTimeout(r, 3000));
      result = await callFacilitatorSettle(payload, paymentRequirements);
    } else {
      throw err;
    }
  }

  if (!result.success || !result.transaction) {
    throw new PaymentServiceError(
      "PAYMENT_FAILED",
      result.error ?? "Settlement failed: no transaction hash returned",
      false,
    );
  }

  return {
    txHash: result.transaction,
    settledAt: new Date(),
  };
}

