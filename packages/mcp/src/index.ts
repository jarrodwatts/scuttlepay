#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ApiClient } from "./api-client.js";

import packageJson from "../package.json" with { type: "json" };

const config = loadConfig();
const client = new ApiClient(config);

const server = new McpServer({
  name: "scuttlepay",
  version: packageJson.version,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});

export { server, client };
