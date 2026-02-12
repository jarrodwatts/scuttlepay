import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { apiKeyRouter } from "~/server/api/routers/api-key";
import { productRouter } from "~/server/api/routers/product";
import { purchaseRouter } from "~/server/api/routers/purchase";
import { transactionRouter } from "~/server/api/routers/transaction";
import { walletRouter } from "~/server/api/routers/wallet";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  apiKey: apiKeyRouter,
  product: productRouter,
  purchase: purchaseRouter,
  transaction: transactionRouter,
  wallet: walletRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
