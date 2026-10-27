// Shift queries for API routes. Every query filters by the courier's firm and user from the verified session.
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, min, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { cars, depots, firmSettings, shiftChanges, shiftPhotos, shifts } from "@/db/schema";
import { todayIn } from "@/domain/dates";
import { EXPECTED_SHIFT_PHOTOS } from "@/domain/photos";
import { finishProblem, type FinishProblem, type ShiftPatch, type StartInput } from "@/domain/shift";
import type { Bus, Firm, RejectReason, Shift, Station } from "@/domain/types";

import { firmName, type Courier } from "./auth";
import { breakMinutesSql } from "./work-rules";

const editable = ["draft", "rejected"] as const;

const shiftSelect = {
  shift: shifts,
  depotName: depots.name,
  carPlate: cars.plate,
  carVin: cars.vin,
  breakMinutes: breakMinutesSql,
  corrected: sql<boolean>`exists (select 1 from ${shiftChanges} where ${shiftChanges.shiftId} = ${shifts.id})`,
  photoCount: sql<number>`(select count(*)::int from ${shiftPhotos} where ${shiftPhotos.shiftId} = ${shifts.id} and ${inArray(shiftPhotos.slot, [...EXPECTED_SHIFT_PHOTOS])})`,
};

type ShiftRow = {
  shift: typeof shifts.$inferSelect;
  depotName: string;
  carPlate: string;
  carVin: string | null;
  breakMinutes: number | null;
  corrected: boolean;
  photoCount: number;
};

export function toShift({ shift: s, depotName, carPlate, carVin, breakMinutes, corrected, photoCount }: ShiftRow): Shift {
  return {
    id: s.id,
    date: s.date,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    finishedAt: s.finishedAt?.toISOString() ?? null,
    minutes: s.minutes,
    breakMinutes,
    workedMinutes: s.minutes === null || breakMinutes === null ? null : s.minutes - breakMinutes,
    depot: { id: s.depotId, name: depotName },
    car: { id: s.carId, plate: carPlate, vin: carVin },
    startKm: s.startKm,
    endKm: s.endKm,
    loaded: s.loaded,
    returned: s.returned,
    pickups: s.pickups,
    corrected,
    photoCount,
    ...(s.status === "rejected"
      ? { rejection: { reasons: (s.rejectionReasons ?? []) as RejectReason[], note: s.rejectionNote } }
      : {}),
  };
}

/** The courier's own shifts, plus any extra conditions. Every shift query and update filters through this. */
function mine({ firmId, userId }: Courier, ...extra: SQL[]) {
  return and(eq(shifts.firmId, firmId), eq(shifts.userId, userId), ...extra);
}

/** Shifts joined with their depot and car, plus whether anyone corrected them. Add a firm-scoped where. */
export function selectShifts() {
  return db
    .select(shiftSelect)
    .from(shifts)
    .innerJoin(depots, eq(depots.id, shifts.depotId))
    .innerJoin(cars, eq(cars.id, shifts.carId))
    .$dynamic();
}

/** Firm settings plus its name, or null when the firm has no settings yet (not seeded). */
export async function loadFirm(firmId: string): Promise<Firm | null> {
  const [settings] = await db.select().from(firmSettings).where(eq(firmSettings.firmId, firmId));
  if (!settings) return null;
  return { name: await firmName(firmId), currency: settings.currency, timeZone: settings.timeZone };
}

export async function activeStations(firmId: string): Promise<Station[]> {
  return db
    .select({ id: depots.id, name: depots.name })
    .from(depots)
    .where(and(eq(depots.firmId, firmId), isNull(depots.archivedAt)))
    .orderBy(depots.name);
}

export async function activeBuses(firmId: string): Promise<Bus[]> {
  return db
    .select({ id: cars.id, plate: cars.plate })
    .from(cars)
    .where(and(eq(cars.firmId, firmId), isNull(cars.archivedAt)))
    .orderBy(cars.plate);
}

export async function shiftOn(courier: Courier, date: string): Promise<Shift | null> {
  const [row] = await selectShifts().where(mine(courier, eq(shifts.date, date)));
  return row ? toShift(row) : null;
}

/** Up to `limit` shifts before `date`, newest first. */
export async function shiftsBefore(courier: Courier, date: string, limit: number): Promise<Shift[]> {
  const rows = await selectShifts()
    .where(mine(courier, lt(shifts.date, date)))
    .orderBy(desc(shifts.date))
    .limit(limit);
  return rows.map(toShift);
}

/** Every shift from `from` to `to`, inclusive, oldest first. */
export async function shiftsBetween(courier: Courier, from: string, to: string): Promise<Shift[]> {
  const rows = await selectShifts()
    .where(mine(courier, gte(shifts.date, from), lte(shifts.date, to)))
    .orderBy(asc(shifts.date));
  return rows.map(toShift);
}

/** The day of the courier's first shift, or null when there is none. */
export async function firstShiftDate(courier: Courier): Promise<string | null> {
  const [row] = await db.select({ first: min(shifts.date) }).from(shifts).where(mine(courier));
  return row?.first ?? null;
}

/** True when the depot and car (whichever are given) are active ones in this firm. */
export async function ownsDepotAndCar(firmId: string, depotId?: string, carId?: string): Promise<boolean> {
  const [depotOk, carOk] = await Promise.all([
    depotId
      ? db
          .select({ id: depots.id })
          .from(depots)
          .where(and(eq(depots.id, depotId), eq(depots.firmId, firmId), isNull(depots.archivedAt)))
          .then((rows) => rows.length === 1)
      : true,
    carId
      ? db
          .select({ id: cars.id })
          .from(cars)
          .where(and(eq(cars.id, carId), eq(cars.firmId, firmId), isNull(cars.archivedAt)))
          .then((rows) => rows.length === 1)
      : true,
  ]);
  return depotOk && carOk;
}

/** Starts today's shift now. Null when one already exists for this day. */
export async function startShift(courier: Courier, date: string, input: StartInput): Promise<Shift | null> {
  const inserted = await db
    .insert(shifts)
    .values({ ...courier, date, ...input, startedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: shifts.id });
  return inserted.length ? shiftOn(courier, date) : null;
}

/** Applies a patch to the day's draft or rejected shift. Null when there is no shift or it can't be edited. */
export async function updateShift(courier: Courier, date: string, patch: ShiftPatch): Promise<Shift | null> {
  const updated = await db
    .update(shifts)
    .set({ ...patch, updatedAt: new Date() })
    .where(mine(courier, eq(shifts.date, date), inArray(shifts.status, editable)))
    .returning({ id: shifts.id });
  return updated.length ? shiftOn(courier, date) : null;
}

/**
 * Submits the day's shift: finish time and working time are set by the database clock. One conditional update,
 * so two submits can't both succeed. Returns the reason when it can't be submitted.
 */
export async function submitShift(
  courier: Courier,
  date: string,
): Promise<Shift | "notFound" | "notEditable" | FinishProblem> {
  const current = await shiftOn(courier, date);
  if (!current) return "notFound";
  if (!editable.includes(current.status as (typeof editable)[number])) return "notEditable";
  const problem = finishProblem(current);
  if (problem) return problem;

  const updated = await db
    .update(shifts)
    .set(submitted)
    .where(
      mine(
        courier,
        eq(shifts.date, date),
        inArray(shifts.status, editable),
        sql`${shifts.endKm} >= ${shifts.startKm}`,
        sql`coalesce(${shifts.returned}, 0) <= ${shifts.loaded}`,
      ),
    )
    .returning({ id: shifts.id });
  // Changed between the read and the update (e.g. a second device): report what it is now.
  if (!updated.length) return "notEditable";
  return (await shiftOn(courier, date))!;
}

/**
 * The update that submits a shift. A draft finishes now; a rejected shift being resubmitted keeps the times it
 * already has, so fixing it days later doesn't inflate its hours. Clears the previous review.
 */
const submitted = {
  status: "submitted" as const,
  finishedAt: sql`coalesce(${shifts.finishedAt}, now())`,
  submittedAt: sql`now()`,
  minutes: sql`greatest(0, floor(extract(epoch from (coalesce(${shifts.finishedAt}, now()) - ${shifts.startedAt})) / 60))::int`,
  rejectionReasons: null,
  rejectionNote: null,
  reviewedAt: null,
  reviewedBy: null,
  updatedAt: sql`now()`,
};

/** One of the courier's own shifts by id, or null (also when it belongs to someone else). */
export async function ownShift(courier: Courier, id: string): Promise<Shift | null> {
  const [row] = await selectShifts().where(mine(courier, eq(shifts.id, id)));
  return row ? toShift(row) : null;
}

/** Applies a courier's fix to their own rejected shift. Null when it isn't theirs or isn't rejected any more. */
export async function fixShift(courier: Courier, id: string, values: ShiftValues): Promise<Shift | null> {
  const updated = await db
    .update(shifts)
    .set({ ...values, updatedAt: new Date() })
    .where(mine(courier, eq(shifts.id, id), eq(shifts.status, "rejected")))
    .returning({ id: shifts.id });
  return updated.length ? ownShift(courier, id) : null;
}

/** Resubmits the courier's own rejected shift after it passes the finish checks. */
export async function resubmitShift(
  courier: Courier,
  id: string,
): Promise<Shift | "notFound" | "notEditable" | FinishProblem> {
  const current = await ownShift(courier, id);
  if (!current) return "notFound";
  if (current.status !== "rejected") return "notEditable";
  const problem = finishProblem(current);
  if (problem) return problem;
  const updated = await db
    .update(shifts)
    .set(submitted)
    .where(mine(courier, eq(shifts.id, id), eq(shifts.status, "rejected")))
    .returning({ id: shifts.id });
  return updated.length ? (await ownShift(courier, id))! : "notEditable";
}

/** Column values a correction or fix writes. */
export type ShiftValues = Partial<
  Pick<
    typeof shifts.$inferInsert,
    "depotId" | "carId" | "startedAt" | "finishedAt" | "minutes" | "startKm" | "endKm" | "loaded" | "returned" | "pickups"
  >
>;

/** Today in the firm's timezone. */
export function firmToday(firm: Firm): string {
  return todayIn(firm.timeZone);
}
