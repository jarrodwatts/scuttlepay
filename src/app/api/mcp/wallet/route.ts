import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import { withApiKey } from "~/app/api/mcp/_middleware";
import { getBalance } from "~/server/services/wallet.service";

export const GET = withApiKey(async (_req, ctx) => {
  const wallet = await db
    .select({
      id: wallets.id,
      address: wallets.address,
      chainId: wallets.chainId,
      label: wallets.label,
      isActive: wallets.isActive,
      createdAt: wallets.createdAt,
    })
    .from(wallets)
    .where(
      and(eq(wallets.id, ctx.walletId), eq(wallets.isActive, true)),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!wallet) {
    return NextResponse.json(
      { error: { code: "WALLET_NOT_FOUND", message: "Wallet not found" } },
      { status: 404 },
    );
  }

  const balance = await getBalance(ctx.walletId);

  return NextResponse.json({ data: { ...wallet, balance } });
});
