import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

function getDbUrl(): string {
  const url = process.env["POSTGRES_URL"];
  if (!url) throw new Error("POSTGRES_URL environment variable is required");
  return url;
}

export function createDb() {
  const sql = neon(getDbUrl());
  return drizzle({ client: sql, schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };
