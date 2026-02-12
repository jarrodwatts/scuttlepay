import { and, eq } from "drizzle-orm";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { wallets } from "~/server/db/schema/wallet";
import {
  validateApiKey,
  ApiKeyError,
} from "~/server/lib/validate-api-key";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
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

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export const authedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (ctx.session?.user) {
      const wallet = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(
            eq(wallets.userId, ctx.session.user.id),
            eq(wallets.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      return next({
        ctx: {
          userId: ctx.session.user.id,
          walletId: wallet?.id ?? null,
        },
      });
    }

    const authHeader = ctx.headers.get("authorization");
    try {
      const apiKeyCtx = await validateApiKey(authHeader);
      return next({
        ctx: {
          userId: apiKeyCtx.userId,
          walletId: apiKeyCtx.walletId,
        },
      });
    } catch (err) {
      if (err instanceof ApiKeyError) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.message });
      }
      throw err;
    }
  });
