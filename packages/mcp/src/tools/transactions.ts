import { z } from "zod";
import { isScuttlePayError, toAgentMessage } from "@scuttlepay/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function registerGetTransactions(server: McpServer, client: ApiClient) {
  server.registerTool("get_transactions", {
    description:
      "View recent purchase history including amounts, products, status, and blockchain transaction hashes.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Number of transactions to return (default 10, max 100)"),
    },
  }, async ({ limit }) => {
    try {
      const { data: rows } = await client.getTransactions(limit ?? 10);

      if (rows.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No transactions yet." }],
        };
      }

      const lines = rows.map((tx) => {
        const date = formatDate(tx.initiatedAt);
        const hash = tx.txHash ?? "pending";
        return `${date} — ${tx.productName} — $${tx.amountUsdc} — ${tx.status} — tx: ${hash}`;
      });

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
