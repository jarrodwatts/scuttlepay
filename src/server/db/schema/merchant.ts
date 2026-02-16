import { createTable } from "./table-creator";

export const merchants = createTable(
  "merchant",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopDomain: d.text().notNull().unique(),
    accessToken: d.text().notNull(),
    storefrontToken: d.text(),
    scopes: d.text().notNull(),
    isActive: d.boolean().notNull().default(true),
    installedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    uninstalledAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  }),
);
