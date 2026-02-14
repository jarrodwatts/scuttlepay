import { index } from "drizzle-orm/pg-core";
import { createTable } from "./table-creator";
import { users } from "./auth";

export const apiKeys = createTable(
  "api_key",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: d.text().notNull(),
    keyPrefix: d.varchar({ length: 12 }).notNull(),
    name: d.varchar({ length: 255 }).notNull(),
    isActive: d.boolean().notNull().default(true),
    lastUsedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("api_key_user_id_idx").on(t.userId),
    index("api_key_prefix_active_idx").on(t.keyPrefix, t.isActive),
    index("api_key_hash_active_idx").on(t.keyHash, t.isActive),
  ],
);
