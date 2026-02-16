import { TRPCError } from "@trpc/server";
import { CHAIN_NAMES, walletBalanceSchema } from "@scuttlepay/shared";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { chainId } from "~/server/lib/thirdweb";
import {
  getBalance,
  getAddress,
  WalletServiceError,
} from "~/server/services/wallet.service";
import { requireWalletId } from "~/server/lib/require-wallet";

function mapServiceError(err: unknown): never {
  if (err instanceof WalletServiceError) {
    throw new TRPCError({
      code: err.code === "WALLET_NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw err;
}

const chainName = CHAIN_NAMES[chainId];

export const walletRouter = createTRPCRouter({
  getBalance: authedProcedure.output(walletBalanceSchema).query(async ({ ctx }) => {
    const walletId = requireWalletId(ctx.walletId);

    try {
      const balance = await getBalance(walletId);
      return {
        balance,
        currency: "USD" as const,
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
