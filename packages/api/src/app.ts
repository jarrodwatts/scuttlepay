import { Hono } from "hono";
import { logger } from "hono/logger";
import { ScuttlePayError, ErrorCode } from "@scuttlepay/shared";
import { createDb } from "./db/index.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./routes/health.js";
import { authMiddleware } from "./middleware/auth.js";

export function createApp() {
  const db = createDb();
  const app = new Hono();

  app.use("*", requestId);
  app.use("*", logger());
  app.onError(errorHandler);

  app.route("/", healthRoutes(db));

  app.use("/api/*", authMiddleware(db));

  app.notFound((c) => {
    throw new ScuttlePayError({
      code: ErrorCode.INTERNAL_ERROR,
      message: `Route not found: ${c.req.method} ${c.req.path}`,
    });
  });

  return { app, db };
}
