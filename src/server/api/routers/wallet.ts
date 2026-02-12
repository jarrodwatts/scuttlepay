import { TRPCError } from "@trpc/server";
import { CHAIN_NAMES, walletBalanceSchema } from "@scuttlepay/shared";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { activeChain } from "~/server/lib/thirdweb";
import {
  getBalance,
  getAddress,
  WalletServiceError,
} from "~/server/services/wallet.service";

function requireWalletId(walletId: string | null): string {
  if (!walletId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No active wallet found",
    });
  }
  return walletId;
}

function mapServiceError(err: unknown): never {
  if (err instanceof WalletServiceError) {
    throw new TRPCError({
      code: err.code === "WALLET_NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw err;
}

const chainName = CHAIN_NAMES[activeChain.id as keyof typeof CHAIN_NAMES];

export const walletRouter = createTRPCRouter({
  getBalance: authedProcedure.output(walletBalanceSchema).query(async ({ ctx }) => {
    const walletId = requireWalletId(ctx.walletId);

    try {
      const balance = await getBalance(walletId);
      return {
        balance,
        currency: "USDC" as const,
        chain: chainName,
      };
    } catch (err) {
      mapServiceError(err);
    }
  }),

  getAddress: authedProcedure.query(async ({ ctx }) => {
    const walletId = requireWalletId(ctx.walletId);

    try {
      const address = await getAddress(walletId);
      return {
        address,
        chain: chainName,
      };
    } catch (err) {
      mapServiceError(err);
    }
  }),
});
