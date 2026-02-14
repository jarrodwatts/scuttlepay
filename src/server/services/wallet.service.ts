import { and, eq } from "drizzle-orm";
import type { Address } from "thirdweb";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { USDC_ADDRESSES, USDC_DECIMALS } from "@scuttlepay/shared";

import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import {
  activeChain,
  chainId,
  getThirdwebClient,
  createUserServerWallet,
} from "~/server/lib/thirdweb";

function getUsdcAddress(): Address {
  const address = USDC_ADDRESSES[chainId];
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

export async function getAddress(walletId: string): Promise<Address> {
  const wallet = await findWalletOrThrow(walletId);
  return wallet.address as Address;
}

export async function createWalletForUser(userId: string): Promise<string> {
  const existing = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) return existing.id;

  const { address } = await createUserServerWallet(`user-${userId}`);

  const [wallet] = await db
    .insert(wallets)
    .values({
      userId,
      address,
      chainId: activeChain.id,
      label: "default",
      thirdwebId: address,
    })
    .returning({ id: wallets.id });

  if (!wallet) throw new WalletServiceError("WALLET_NOT_FOUND", "Failed to create wallet");

  return wallet.id;
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
