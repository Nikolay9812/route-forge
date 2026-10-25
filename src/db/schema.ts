// Drizzle table definitions for Neon Postgres. Columns are camelCase here and snake_case in the database.
// Every firm-owned table has a `firmId` (the Clerk Organization ID). Changes reach the database with
// `npm run db:push`, never migrations. Rows salary history depends on are archived, never deleted.
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const payKind = pgEnum("pay_kind", ["hourly", "daily", "firm"]);

/**
 * Pay rates from `effectiveFrom` (a calendar day in the firm's timezone) until the target's next entry. A row
 * with no user is the firm default; a courier's `firm` row (no amount) means "follow the firm default" again.
 */
export const payRates = pgTable(
  "pay_rates",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID of the courier, or null for the firm default. */
    userId: text(),
    effectiveFrom: date({ mode: "string" }).notNull(),
    kind: payKind().notNull(),
    /** Per hour or per shift, by kind. Null exactly for `firm`. */
    amountMinor: integer(),
    /** Clerk user ID of the owner who last set it, and when. */
    setBy: text().notNull(),
    setAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    // One entry per target per day; the firm default (null user) is unique too.
    unique().on(t.firmId, t.userId, t.effectiveFrom).nullsNotDistinct(),
    check("pay_rates_amount", sql`(${t.kind} = 'firm') = (${t.amountMinor} is null) and coalesce(${t.amountMinor}, 1) > 0`),
    check("pay_rates_firm_kind", sql`${t.kind} <> 'firm' or ${t.userId} is not null`),
  ],
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
    /** Reason codes (RejectReason) when rejected. */
    rejectionReasons: text().array(),
    rejectionNote: text(),
    submittedAt: timestamp({ withTimezone: true }),
    /** Set by approve and reject. */
    reviewedAt: timestamp({ withTimezone: true }),
    /** Clerk user ID of the dispatcher or owner who reviewed it. */
    reviewedBy: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Also serves "newest first" reads for one courier (scanned backwards).
  (t) => [uniqueIndex().on(t.firmId, t.userId, t.date)],
);

/** The depots a dispatcher manages. Owners manage every depot and need no rows here. */
export const dispatcherDepots = pgTable(
  "dispatcher_depots",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID of the dispatcher. */
    userId: text().notNull(),
    depotId: uuid()
      .notNull()
      .references(() => depots.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.userId, t.depotId)],
);

/** One row per field a dispatcher or owner corrected: who changed what, and when. */
export const shiftChanges = pgTable(
  "shift_changes",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    shiftId: uuid()
      .notNull()
      .references(() => shifts.id),
    /** Clerk user ID. */
    changedBy: text().notNull(),
    changedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    field: text().notNull(),
    oldValue: text(),
    newValue: text(),
  },
  (t) => [index().on(t.firmId, t.shiftId)],
);
