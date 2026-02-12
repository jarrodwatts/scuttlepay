import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { productRouter } from "~/server/api/routers/product";
import { walletRouter } from "~/server/api/routers/wallet";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  product: productRouter,
  wallet: walletRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
