import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerListMerchants(server: McpServer, client: ApiClient) {
  server.registerTool("list_merchants", {
    description:
      "List all available merchants (Shopify stores) that accept AI agent purchases. Returns merchant IDs and store domains. Use a merchant ID with other tools.",
  }, async () => {
    try {
      const merchants = await client.listMerchants();

      if (merchants.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No merchants are currently available.",
            },
          ],
        };
      }

      const lines = merchants.map(
        (m) => `${m.shopDomain} (ID: ${m.id})`,
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
