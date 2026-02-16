import {
  productSearchParamsSchema,
  productSearchResultSchema,
  productDetailSchema,
} from "@scuttlepay/shared";
import { z } from "zod";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  searchProducts,
  getProduct,
} from "~/server/services/shopify.service";
import { mapServiceError } from "~/server/lib/map-service-error";

export const productRouter = createTRPCRouter({
  search: authedProcedure
    .input(productSearchParamsSchema)
    .output(z.array(productSearchResultSchema))
    .query(async ({ input }) => {
      try {
        return await searchProducts(input.merchantId, input.q, input.limit);
      } catch (err) {
        mapServiceError(err);
      }
    }),

  getById: authedProcedure
    .input(z.object({ merchantId: z.string().min(1), productId: z.string().min(1) }))
    .output(productDetailSchema)
    .query(async ({ input }) => {
      try {
        return await getProduct(input.merchantId, input.productId);
      } catch (err) {
        mapServiceError(err);
      }
    }),
});
