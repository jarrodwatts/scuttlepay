import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env["POSTGRES_URL"];
if (!url) throw new Error("POSTGRES_URL environment variable is required");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
