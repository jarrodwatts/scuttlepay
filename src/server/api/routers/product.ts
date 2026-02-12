import { TRPCError } from "@trpc/server";
import {
  productSearchParamsSchema,
  productSearchResultSchema,
  productDetailSchema,
  ScuttlePayError,
  ErrorCode,
} from "@scuttlepay/shared";
import { z } from "zod";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  searchProducts,
  getProduct,
} from "~/server/services/shopify.service";

function mapServiceError(err: unknown): never {
  if (err instanceof ScuttlePayError) {
    throw new TRPCError({
      code: err.code === ErrorCode.PRODUCT_NOT_FOUND ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw err;
}

export const productRouter = createTRPCRouter({
  search: authedProcedure
    .input(productSearchParamsSchema)
    .output(z.array(productSearchResultSchema))
    .query(async ({ input }) => {
      try {
        return await searchProducts(input.q, input.limit);
      } catch (err) {
        mapServiceError(err);
      }
    }),

  getById: authedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .output(productDetailSchema)
    .query(async ({ input }) => {
      try {
        return await getProduct(input.productId);
      } catch (err) {
        mapServiceError(err);
      }
    }),
});
