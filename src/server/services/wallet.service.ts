import { and, eq } from "drizzle-orm";
import type { Address } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { ErrorCode, ScuttlePayError } from "@scuttlepay/shared";

import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import {
  activeChain,
  createUserServerWallet,
  getUsdcContract,
} from "~/server/lib/thirdweb";
import { formatUsdc } from "~/server/lib/usdc-math";

async function findWalletOrThrow(walletId: string) {
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!wallet) {
    throw new ScuttlePayError({
      code: ErrorCode.WALLET_NOT_FOUND,
      message: `Wallet ${walletId} not found`,
      metadata: { walletId },
    });
  }

  return wallet;
}

export async function getBalance(walletId: string): Promise<string> {
  const wallet = await findWalletOrThrow(walletId);

  const raw = await balanceOf({
    contract: getUsdcContract(),
    address: wallet.address,
  });

  return formatUsdc(raw);
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

  if (!wallet) {
    throw new ScuttlePayError({
      code: ErrorCode.DATABASE_ERROR,
      message: "Failed to create wallet",
      metadata: { userId },
    });
  }

  return wallet.id;
}
