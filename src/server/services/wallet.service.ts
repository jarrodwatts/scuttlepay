import { and, eq } from "drizzle-orm";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";

import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import { activeChain, getThirdwebClient } from "~/server/lib/thirdweb";

const USDC_DECIMALS = 6;

const USDC_ADDRESS: Record<number, string> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

function getUsdcAddress(): string {
  const address = USDC_ADDRESS[activeChain.id];
  if (!address) {
    throw new WalletServiceError(
      "UNSUPPORTED_CHAIN",
      `USDC not configured for chain ${String(activeChain.id)}`,
    );
  }
  return address;
}

function getUsdcContract() {
  return getContract({
    client: getThirdwebClient(),
    chain: activeChain,
    address: getUsdcAddress(),
  });
}

function formatBalance(raw: bigint): string {
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = raw / divisor;
  const fractional = raw % divisor;
  const fractionStr = fractional.toString().padStart(USDC_DECIMALS, "0");
  return `${whole.toString()}.${fractionStr}`;
}

async function findWalletOrThrow(walletId: string) {
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!wallet) {
    throw new WalletServiceError(
      "WALLET_NOT_FOUND",
      `Wallet ${walletId} not found`,
    );
  }

  return wallet;
}

export async function getBalance(walletId: string): Promise<string> {
  const wallet = await findWalletOrThrow(walletId);

  const raw = await balanceOf({
    contract: getUsdcContract(),
    address: wallet.address,
  });

  return formatBalance(raw);
}

export async function getWallet(walletId: string) {
  return findWalletOrThrow(walletId);
}

export async function getWalletByUserId(userId: string) {
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!wallet) {
    throw new WalletServiceError(
      "WALLET_NOT_FOUND",
      `No active wallet found for user ${userId}`,
    );
  }

  return wallet;
}

export async function getAddress(walletId: string): Promise<string> {
  const wallet = await findWalletOrThrow(walletId);
  return wallet.address;
}

export type WalletServiceErrorCode =
  | "WALLET_NOT_FOUND"
  | "UNSUPPORTED_CHAIN";

export class WalletServiceError extends Error {
  code: WalletServiceErrorCode;

  constructor(code: WalletServiceErrorCode, message: string) {
    super(message);
    this.name = "WalletServiceError";
    this.code = code;
  }
}
