import { TRPCError } from "@trpc/server";
import {
  purchaseRequestSchema,
  purchaseResultSchema,
} from "@scuttlepay/shared";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { purchase } from "~/server/services/purchase.service";
import { mapServiceError } from "~/server/lib/map-service-error";

function requireString(value: string | null, label: string): string {
  if (!value) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${label} not found`,
    });
  }
  return value;
}

export const purchaseRouter = createTRPCRouter({
  execute: authedProcedure
    .input(purchaseRequestSchema)
    .output(purchaseResultSchema)
    .mutation(async ({ ctx, input }) => {
      const walletId = requireString(ctx.walletId, "Active wallet");
      const apiKeyId = requireString(ctx.apiKeyId, "Agent API key");

      try {
        return await purchase({
          walletId,
          apiKeyId,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
        });
      } catch (err) {
        mapServiceError(err);
      }
    }),
});
