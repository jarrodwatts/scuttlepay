import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerSearchProducts(server: McpServer, client: ApiClient) {
  server.registerTool("search_products", {
    description:
      "Search for products available for purchase from a specific merchant. Returns product names, prices, and IDs. Use list_merchants first to get a merchant ID.",
    inputSchema: {
      merchantId: z.string().describe("Merchant ID to search products from"),
      query: z.string().describe("Search query for products"),
    },
  }, async ({ merchantId, query }) => {
    try {
      const products = await client.searchProducts(merchantId, query);

      if (products.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No products found for "${query}".`,
            },
          ],
        };
      }

      const lines = products.map(
        (p) => `${p.title} — $${p.priceUsdc} (ID: ${p.id})`,
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
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
