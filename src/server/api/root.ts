import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { walletRouter } from "~/server/api/routers/wallet";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  wallet: walletRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
