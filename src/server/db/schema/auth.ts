import { createTable } from "./table-creator";

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  thirdwebUserId: d.text().notNull().unique(),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }),
  image: d.varchar({ length: 255 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}));
