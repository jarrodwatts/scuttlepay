import "dotenv/config";
import { sql } from "drizzle-orm";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env["API_PORT"] ?? 3001);
const { app, db } = createApp();

try {
  await db.execute(sql`SELECT 1`);
  console.log("Database connection verified");
} catch (err: unknown) {
  console.error("Failed to connect to database at startup:", err);
  process.exit(1);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ScuttlePay API running on http://localhost:${info.port}`);
});
