import { and, eq } from "drizzle-orm";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getAuthUser, type AuthUser } from "~/server/auth";
import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import {
  validateApiKey,
  ApiKeyError,
} from "~/server/lib/validate-api-key";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const user = await getAuthUser();

  return {
    db,
    user,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const simulateLatency = process.env.TRPC_SIMULATE_LATENCY === "true";

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (simulateLatency) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  if (t._config.isDev) {
    const end = Date.now();
    console.log(`[TRPC] ${path} took ${end - start}ms to execute`);
  }

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: { user: ctx.user satisfies AuthUser },
    });
  });

interface AuthedCtx {
  userId: string;
  walletId: string | null;
  apiKeyId: string | null;
}

export const authedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (ctx.user) {
      const wallet = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(
            eq(wallets.userId, ctx.user.id),
            eq(wallets.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      return next({
        ctx: {
          userId: ctx.user.id,
          walletId: wallet?.id ?? null,
          apiKeyId: null,
        } satisfies AuthedCtx,
      });
    }

    const authHeader = ctx.headers.get("authorization");
    try {
      const apiKeyCtx = await validateApiKey(authHeader);
      return next({
        ctx: {
          userId: apiKeyCtx.userId,
          walletId: apiKeyCtx.walletId,
          apiKeyId: apiKeyCtx.apiKeyId,
        } satisfies AuthedCtx,
      });
    } catch (err) {
      if (err instanceof ApiKeyError) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.message });
      }
      throw err;
    }
  });
