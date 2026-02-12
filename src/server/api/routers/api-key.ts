import { and, eq, desc } from "drizzle-orm";

import { protectedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { apiKeys } from "~/server/db/schema/api-key";
import { generateApiKey } from "~/server/lib/api-key";

export const apiKeyRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, ctx.session.user.id),
          eq(apiKeys.isActive, true),
        ),
      )
      .orderBy(desc(apiKeys.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) return null;

    return {
      id: row.id,
      keyPrefix: row.keyPrefix,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    };
  }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.userId, ctx.session.user.id));

    const { raw, hash, prefix } = generateApiKey();

    await ctx.db.insert(apiKeys).values({
      userId: ctx.session.user.id,
      keyHash: hash,
      keyPrefix: prefix,
      name: "agent-key",
    });

    return { raw };
  }),
});
