import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

const BASESCAN_TX_URL = "https://basescan.org/tx/";

export function registerBuy(server: McpServer, client: ApiClient) {
  server.registerTool("buy", {
    description:
      "Purchase a product using your ScuttlePay wallet. Pays with USDC via x402 protocol. Returns order confirmation with blockchain transaction hash.",
    inputSchema: {
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
  }, async ({ productId, variantId, quantity }) => {
    try {
      const result = await client.purchase({ productId, variantId, quantity });

      const orderPart = result.orderNumber
        ? ` Order #${result.orderNumber}.`
        : "";

      const text = [
        `Purchased ${result.product.name} for $${result.amount} USDC.${orderPart}`,
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
