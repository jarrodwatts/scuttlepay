import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { apiKeys } from "~/server/db/schema/api-key";
import { spendingPolicies } from "~/server/db/schema/wallet";
import { wallets } from "~/server/db/schema/wallet";
import { generateApiKey } from "~/server/lib/api-key";

const createAgentInput = z.object({
  name: z.string().min(1).max(255),
  maxPerTx: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
  dailyLimit: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
});

const updateAgentInput = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  maxPerTx: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format")
    .optional(),
  dailyLimit: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format")
    .optional(),
});

export const agentRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        policyId: spendingPolicies.id,
        maxPerTx: spendingPolicies.maxPerTx,
        dailyLimit: spendingPolicies.dailyLimit,
      })
      .from(apiKeys)
      .leftJoin(spendingPolicies, eq(spendingPolicies.apiKeyId, apiKeys.id))
      .where(
        and(eq(apiKeys.userId, ctx.user.id), eq(apiKeys.isActive, true)),
      )
      .orderBy(desc(apiKeys.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.keyPrefix,
      isActive: r.isActive,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      spendingPolicy:
        r.policyId && r.maxPerTx && r.dailyLimit
          ? { maxPerTx: r.maxPerTx, dailyLimit: r.dailyLimit }
          : null,
    }));
  }),

  create: protectedProcedure
    .input(createAgentInput)
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(eq(wallets.userId, ctx.user.id), eq(wallets.isActive, true)),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active wallet found",
        });
      }

      const { raw, hash, prefix } = generateApiKey();

      const newKey = await ctx.db.transaction(async (tx) => {
        const [key] = await tx
          .insert(apiKeys)
          .values({
            userId: ctx.user.id,
            keyHash: hash,
            keyPrefix: prefix,
            name: input.name,
          })
          .returning({ id: apiKeys.id });

        if (!key) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create agent",
          });
        }

        await tx.insert(spendingPolicies).values({
          walletId: wallet.id,
          apiKeyId: key.id,
          name: input.name,
          maxPerTx: input.maxPerTx,
          dailyLimit: input.dailyLimit,
        });

        return key;
      });

      return { id: newKey.id, raw };
    }),

  update: protectedProcedure
    .input(updateAgentInput)
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.agentId),
            eq(apiKeys.userId, ctx.user.id),
            eq(apiKeys.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      await ctx.db.transaction(async (tx) => {
        if (input.name !== undefined) {
          await tx
            .update(apiKeys)
            .set({ name: input.name })
            .where(eq(apiKeys.id, agent.id));
        }

        if (input.maxPerTx !== undefined || input.dailyLimit !== undefined) {
          const policyUpdate: Partial<Pick<typeof spendingPolicies.$inferInsert, "maxPerTx" | "dailyLimit">> = {};
          if (input.maxPerTx !== undefined) policyUpdate.maxPerTx = input.maxPerTx;
          if (input.dailyLimit !== undefined) policyUpdate.dailyLimit = input.dailyLimit;

          await tx
            .update(spendingPolicies)
            .set(policyUpdate)
            .where(
              and(
                eq(spendingPolicies.apiKeyId, agent.id),
                eq(spendingPolicies.isActive, true),
              ),
            );
        }
      });

      return { success: true };
    }),

  revoke: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.agentId),
            eq(apiKeys.userId, ctx.user.id),
            eq(apiKeys.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(apiKeys)
          .set({ isActive: false })
          .where(eq(apiKeys.id, agent.id));

        await tx
          .update(spendingPolicies)
          .set({ isActive: false })
          .where(eq(spendingPolicies.apiKeyId, agent.id));
      });

      return { success: true };
    }),

  rotateKey: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.agentId),
            eq(apiKeys.userId, ctx.user.id),
            eq(apiKeys.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      const { raw, hash, prefix } = generateApiKey();

      await ctx.db
        .update(apiKeys)
        .set({ keyHash: hash, keyPrefix: prefix })
        .where(eq(apiKeys.id, agent.id));

      return { raw };
    }),
});
