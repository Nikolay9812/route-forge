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
    /** Normalised (17 characters, no I, O or Q), unique per firm when set. */
    vin: text(),
    /** TÜV (HU) due: the last day of the month on the sticker. */
    tuvDueOn: date({ mode: "string" }),
    insuranceExpiresOn: date({ mode: "string" }),
    serviceDueOn: date({ mode: "string" }),
    serviceDueKm: integer(),
    /** Clerk user ID of whoever saved the papers last, and when. */
    papersUpdatedBy: text(),
    papersUpdatedAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.plate), uniqueIndex().on(t.firmId, t.vin)],
);

/** A car's registration certificate photo (`talon`), owner-only. Postgres keeps only the R2 object key. */
export const carPhotos = pgTable(
  "car_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    slot: text().notNull(),
    objectKey: text().notNull(),
    contentType: text().notNull(),
    /** Bytes. */
    size: integer().notNull(),
    /** Clerk user ID of whoever uploaded it, and when. */
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.carId, t.slot)],
);

/**
 * A car's service log: work a mechanic (or the owner) did on it, dated by the day it was done. Its author may
 * change or delete it for 7 days; the owner may delete any. Notes aren't salary history, so deleting is real.
 */
export const carNotes = pgTable(
  "car_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    /** CarNoteType. */
    type: text().notNull(),
    /** Calendar day the work was done, in the firm's timezone. */
    doneOn: date({ mode: "string" }).notNull(),
    km: integer(),
    text: text(),
    /** Clerk user ID of the author, and when; then of whoever changed it last. */
    createdBy: text().notNull(),
    createdAt: createdAt(),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.firmId, t.doneOn), index().on(t.firmId, t.carId, t.doneOn)],
);

/** Up to three photos per service log note. Postgres keeps only the R2 object key. */
export const carNotePhotos = pgTable(
  "car_note_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    noteId: uuid()
      .notNull()
      .references(() => carNotes.id, { onDelete: "cascade" }),
    slot: text().notNull(),
    objectKey: text().notNull(),
    contentType: text().notNull(),
    /** Bytes. */
    size: integer().notNull(),
    /** Clerk user ID of whoever uploaded it, and when. */
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.noteId, t.slot)],
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

/**
 * The firm's automatic break and Spesen, dated like pay rates: on a day the latest entry on or before it applies,
 * none means no break and no Spesen. Minutes are shift time (finish − start); Spesen in minor units, 0 = off.
 */
export const firmRules = pgTable(
  "firm_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    effectiveFrom: date({ mode: "string" }).notNull(),
    breakAfterMinutes: integer().notNull(),
    breakMinutes: integer().notNull(),
    longBreakAfterMinutes: integer().notNull(),
    longBreakMinutes: integer().notNull(),
    spesenAfterMinutes: integer().notNull(),
    spesenMinor: integer().notNull(),
    /** Clerk user ID of the owner who last set it, and when. */
    setBy: text().notNull(),
    setAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.firmId, t.effectiveFrom),
    check(
      "firm_rules_values",
      sql`${t.longBreakAfterMinutes} > ${t.breakAfterMinutes} and ${t.longBreakMinutes} >= ${t.breakMinutes} and ${t.breakMinutes} >= 0 and ${t.spesenMinor} >= 0`,
    ),
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

export const gender = pgEnum("gender", ["female", "male", "diverse"]);

/**
 * A courier's personal documents, one row per courier per firm, created on their first save. Every field is
 * optional; the courier edits their own row and the firm's owner edits anyone's. Personal data: never logged.
 */
export const courierDetails = pgTable(
  "courier_details",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID of the courier. */
    userId: text().notNull(),
    idNumber: text(),
    nationality: text(),
    placeOfBirth: text(),
    birthDate: date({ mode: "string" }),
    gender: gender(),
    idAddress: text(),
    idIssuedOn: date({ mode: "string" }),
    idExpiresOn: date({ mode: "string" }),
    licenceNumber: text(),
    licenceClasses: text().array(),
    licenceIssuedOn: date({ mode: "string" }),
    licenceExpiresOn: date({ mode: "string" }),
    /** Registered address in Germany (Anmeldung). */
    street: text(),
    postcode: text(),
    city: text(),
    /** Steuer-ID. */
    taxId: text(),
    taxClass: integer(),
    /** Sozialversicherungsnummer. */
    socialNumber: text(),
    healthInsurer: text(),
    healthNumber: text(),
    /** Führungszeugnis. */
    criminalRecordIssuedOn: date({ mode: "string" }),
    bankHolder: text(),
    iban: text(),
    phone: text(),
    emergencyName: text(),
    emergencyPhone: text(),
    /** Clerk user ID of whoever saved last (the courier or the owner), and when. */
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.firmId, t.userId),
    check("courier_details_tax_class", sql`${t.taxClass} between 1 and 6`),
  ],
);

/**
 * One stored photo per document slot of a courier. The file itself lives in the private R2 bucket under
 * `objectKey`; replacing or removing a photo deletes the old file and this row (photos aren't salary history).
 */
export const documentPhotos = pgTable(
  "document_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    /** Clerk user ID of the courier the document belongs to. */
    userId: text().notNull(),
    section: text().notNull(),
    slot: text().notNull(),
    objectKey: text().notNull(),
    contentType: text().notNull(),
    /** Bytes. */
    size: integer().notNull(),
    /** Clerk user ID of whoever uploaded it (the courier or the owner), and when. */
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.userId, t.section, t.slot)],
);

/**
 * One vehicle check photo per shift slot (the bus from four sides plus extras, logbook, Mentor, diesel and AdBlue).
 * The file lives in the private R2 bucket under `objectKey`. Replacing or removing a photo deletes the old file and
 * this row; otherwise rows stay as long as their shift, which is never deleted.
 */
export const shiftPhotos = pgTable(
  "shift_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    firmId: text().notNull(),
    shiftId: uuid()
      .notNull()
      .references(() => shifts.id),
    /** Clerk user ID of the courier whose shift it is. */
    userId: text().notNull(),
    slot: text().notNull(),
    objectKey: text().notNull(),
    contentType: text().notNull(),
    /** Bytes. */
    size: integer().notNull(),
    /** Clerk user ID of whoever uploaded it, and when. */
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.firmId, t.shiftId, t.slot)],
);
