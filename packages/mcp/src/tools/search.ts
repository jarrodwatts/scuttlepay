import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerSearchProducts(server: McpServer, client: ApiClient) {
  server.registerTool("search_products", {
    description:
      "Search for products available for purchase. Returns product names, prices in USDC, and IDs. Use a product ID from the results to get details or buy.",
    inputSchema: {
      query: z.string().describe("Search query for products"),
    },
  }, async ({ query }) => {
    try {
      const products = await client.searchProducts(query);

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
        (p) => `${p.title} — $${p.priceUsdc} USDC (ID: ${p.id})`,
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
