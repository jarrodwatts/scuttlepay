import { TRPCError } from "@trpc/server";

export function requireWalletId(walletId: string | null): string {
  if (!walletId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No active wallet found",
    });
  }
  return walletId;
}
