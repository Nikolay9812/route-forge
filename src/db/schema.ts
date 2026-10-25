// Drizzle table definitions for Neon Postgres. Columns are camelCase here and snake_case in the database.
// Every firm-owned table has a `firmId` (the Clerk Organization ID). Changes reach the database with
// `npm run db:push`, never migrations. Rows salary history depends on are archived, never deleted.
import { date, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** Currency and timezone per firm. The firm's name comes from the Clerk Organization. */
export const firmSettings = pgTable("firm_settings", {
  firmId: text().primaryKey(),
  currency: text().notNull(),
  timeZone: text().notNull(),
  createdAt: createdAt(),
});

export const depots = pgTable(
  "depots",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    name: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.name)],
);

export const cars = pgTable(
  "cars",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    plate: text().notNull(),
    depotId: uuid()
      .notNull()
      .references(() => depots.id),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.plate)],
);

/** A courier's hourly rate from `effectiveFrom` (a calendar day in the firm's timezone) until the next one. */
export const courierRates = pgTable(
  "courier_rates",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID. */
    userId: text().notNull(),
    effectiveFrom: date({ mode: "string" }).notNull(),
    hourlyMinor: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.userId, t.effectiveFrom)],
);

export const shiftStatus = pgEnum("shift_status", ["draft", "submitted", "approved", "rejected"]);

/** One courier, one day. Delivered (loaded − returned) and km driven (end − start) are derived, never stored. */
export const shifts = pgTable(
  "shifts",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID of the courier. */
    userId: text().notNull(),
    /** Calendar day in the firm's timezone. */
    date: date({ mode: "string" }).notNull(),
    status: shiftStatus().notNull().default("draft"),
    depotId: uuid()
      .notNull()
      .references(() => depots.id),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    finishedAt: timestamp({ withTimezone: true }),
    /** Working time, set on submit. */
    minutes: integer(),
    startKm: integer().notNull(),
    endKm: integer(),
    loaded: integer().notNull(),
    returned: integer(),
    /** Customer returns collected (Abholung). */
    pickups: integer(),
    rejectionReason: text(),
    submittedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Also serves "newest first" reads for one courier (scanned backwards).
  (t) => [uniqueIndex().on(t.firmId, t.userId, t.date)],
);
