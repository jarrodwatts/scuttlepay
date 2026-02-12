import { type Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["scuttlepay_*"],
} satisfies Config;
