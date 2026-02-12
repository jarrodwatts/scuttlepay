import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerGetBalance(server: McpServer, client: ApiClient) {
  server.registerTool("get_balance", {
    description:
      "Check your current ScuttlePay wallet balance in USDC.",
  }, async () => {
    try {
      const balance = await client.getBalance();

      return {
        content: [
          {
            type: "text" as const,
            text: `Your ScuttlePay balance is $${balance} USDC`,
          },
        ],
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
