import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env["API_PORT"] ?? 3001);
const { app } = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ScuttlePay API running on http://localhost:${info.port}`);
});
