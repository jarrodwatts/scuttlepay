import { config } from "dotenv";
import { type Config } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

export default {
  schema: "./src/server/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["scuttlepay_*"],
} satisfies Config;
