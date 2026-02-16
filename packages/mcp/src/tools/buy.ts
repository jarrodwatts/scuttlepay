import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

const BASESCAN_TX_URL = "https://basescan.org/tx/";

export function registerBuy(server: McpServer, client: ApiClient) {
  server.registerTool("buy", {
    description:
      "Purchase a product from a merchant using your ScuttlePay wallet. Returns order confirmation with transaction details.",
    inputSchema: {
      merchantId: z.string().describe("Merchant ID to purchase from"),
      productId: z.string().describe("Product ID to purchase"),
      variantId: z
        .string()
        .optional()
        .describe("Variant ID if the product has multiple variants"),
      quantity: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Quantity to purchase (defaults to 1)"),
    },
  }, async ({ merchantId, productId, variantId, quantity }) => {
    try {
      const result = await client.purchase({ merchantId, productId, variantId, quantity });

      const orderPart = result.orderNumber
        ? ` Order #${result.orderNumber}.`
        : "";

      const text = [
        `Purchased ${result.product.name} for $${result.amount}.${orderPart}`,
        `Transaction: ${result.txHash}`,
        `Verify on Basescan: ${BASESCAN_TX_URL}${result.txHash}`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      if (isScuttlePayError(err)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: toAgentMessage(err) }],
        };
      }
      throw err;
    }
  });
}
