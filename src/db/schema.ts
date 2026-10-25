// Drizzle table definitions for Neon Postgres. Columns are camelCase here and snake_case in the database.
// Every firm-owned table has a `firmId`. Changes reach the database with `npm run db:push`, never migrations.
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: uuid().primaryKey().defaultRandom(),
  /** Clerk Organization ID. */
  firmId: text().notNull(),
  title: text().notNull(),
  done: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
