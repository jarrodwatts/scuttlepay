import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerGetProduct(server: McpServer, client: ApiClient) {
  server.registerTool("get_product", {
    description:
      "Get detailed information about a specific product including all variants, descriptions, images, and exact pricing.",
    inputSchema: {
      merchantId: z.string().describe("Merchant ID the product belongs to"),
      productId: z.string().describe("Product ID from search results"),
    },
  }, async ({ merchantId, productId }) => {
    try {
      const product = await client.getProduct(merchantId, productId);

      const variantLines = product.variants.map(
        (v) => `  - ${v.title}: $${v.priceUsdc} (variant ID: ${v.id})`,
      );

      const imageLines = product.images.map((url) => `  - ${url}`);

      const sections = [
        `${product.title}`,
        `Price: $${product.priceUsdc}`,
        "",
        product.description,
      ];

      if (variantLines.length > 0) {
        sections.push("", "Variants:", ...variantLines);
      }

      if (imageLines.length > 0) {
        sections.push("", "Images:", ...imageLines);
      }

      sections.push("", `Product ID: ${product.id}`);

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
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
