import type { transactions } from "~/server/db/schema/transaction";

export function serializeTransaction(
  row: typeof transactions.$inferSelect,
  agentName: string | null,
) {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    status: row.status,
    amountUsdc: row.amountUsdc,
    txHash: row.txHash,
    merchantAddress: row.merchantAddress,
    productId: row.productId,
    productName: row.productName,
    storeUrl: row.storeUrl,
    errorMessage: row.errorMessage,
    agentName,
    initiatedAt: row.initiatedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
