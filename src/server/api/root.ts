import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
