import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db/index.js";

export function healthRoutes(db: Database) {
  const app = new Hono();

  app.get("/health", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return c.json(
        {
          status: "degraded",
          db: "disconnected",
          timestamp: new Date().toISOString(),
        },
        503,
      );
    }
  });

  return app;
}
