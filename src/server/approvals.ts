// Approval queries for dispatchers and owners. Every query is scoped to the reviewer's firm and, for dispatchers,
// to their depots: a shift outside that scope behaves as if it didn't exist.
import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { cars, depots, dispatcherDepots, shiftChanges, shiftPhotos, shifts } from "@/db/schema";
import { EXPECTED_SHIFT_PHOTOS } from "@/domain/photos";
import { emptyReviewFilters, type ReviewFilters, type ReviewOptions, type ReviewView } from "@/domain/review-filters";
import { rateFor, shiftPay, shiftSpesen } from "@/domain/salary";
import { diffShift } from "@/domain/shift";
import type { Bus, RejectReason, ReviewItem, Shift, ShiftChange, ShiftField, Station } from "@/domain/types";

import { userNames, type Reviewer } from "./auth";
import { payScheduleOf } from "./pay-rates";
import { loadRules } from "./work-rules";
import { shiftPhotoState } from "./shift-photos";
import { selectShifts, toShift, type ShiftValues } from "./shifts";

export type ReviewScope = Reviewer & { depotIds: string[] | "all" };

const REVIEWED_DAYS = 30;
const LIST_LIMIT = 200;

/** The reviewer's depots: all of them for owners, the assigned ones for dispatchers. */
export async function scopeOf(reviewer: Reviewer): Promise<ReviewScope> {
  if (reviewer.role === "owner") return { ...reviewer, depotIds: "all" };
  const rows = await db
    .select({ depotId: dispatcherDepots.depotId })
    .from(dispatcherDepots)
    .where(and(eq(dispatcherDepots.firmId, reviewer.firmId), eq(dispatcherDepots.userId, reviewer.userId)));
  return { ...reviewer, depotIds: rows.map((r) => r.depotId) };
}

export function canUseDepot(scope: ReviewScope, depotId: string): boolean {
  return scope.depotIds === "all" || scope.depotIds.includes(depotId);
}

/** Shifts the reviewer may see, plus any extra conditions. Every approvals query and update filters through this. */
export function inScope(scope: ReviewScope, ...extra: SQL[]) {
  const depotFilter =
    scope.depotIds === "all"
      ? undefined
      : scope.depotIds.length > 0
        ? inArray(shifts.depotId, scope.depotIds)
        : sql`false`;
  return and(eq(shifts.firmId, scope.firmId), depotFilter, ...extra);
}

async function withNames(rows: { shift: Shift; userId: string }[]): Promise<ReviewItem[]> {
  const names = await userNames(rows.map((r) => r.userId));
  return rows.map(({ shift, userId }) => ({ shift, courierName: names.get(userId) ?? "" }));
}

/**
 * Pending: submitted, oldest day first. Reviewed: approved or rejected in the last 30 days, newest review first.
 * Filters narrow the list inside the reviewer's scope, so an ID outside it just matches nothing. Depot and bus
 * sorts run in SQL; the courier sort runs on the capped rows once names are known.
 */
export async function reviewList(scope: ReviewScope, view: ReviewView, filters: ReviewFilters = emptyReviewFilters) {
  const pending = eq(shifts.status, "submitted");
  const reviewed = and(
    inArray(shifts.status, ["approved", "rejected"]),
    gte(shifts.reviewedAt, sql`now() - make_interval(days => ${REVIEWED_DAYS})`),
  )!;
  const where = inScope(scope, view === "pending" ? pending : reviewed, ...filterConditions(view, filters));
  const byDate = view === "pending" ? [asc(shifts.date), asc(shifts.submittedAt)] : [desc(shifts.reviewedAt)];
  const sortFirst =
    filters.sort === "depot" ? [asc(sql`lower(${depots.name})`)] : filters.sort === "bus" ? [asc(cars.plate)] : [];

  const [rows, [{ value: total }], [{ value: pendingCount }], options] = await Promise.all([
    selectShifts()
      .where(where)
      .orderBy(...sortFirst, ...byDate)
      .limit(LIST_LIMIT),
    db.select({ value: count() }).from(shifts).where(where),
    db.select({ value: count() }).from(shifts).where(inScope(scope, pending)),
    reviewOptions(scope, or(pending, reviewed)!),
  ]);
  const items = await withNames(rows.map((r) => ({ shift: toShift(r), userId: r.shift.userId })));
  // Stable, so equal names keep the date order.
  if (filters.sort === "courier") items.sort((a, b) => a.courierName.localeCompare(b.courierName));
  return { pendingCount, total, options, items };
}

function filterConditions(view: ReviewView, filters: ReviewFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.depotId) conditions.push(eq(shifts.depotId, filters.depotId));
  if (filters.carId) conditions.push(eq(shifts.carId, filters.carId));
  if (filters.userId) conditions.push(eq(shifts.userId, filters.userId));
  if (view === "reviewed" && filters.status) conditions.push(eq(shifts.status, filters.status));
  if (filters.corrected) conditions.push(sql`exists (select 1 from ${shiftChanges} where ${shiftChanges.shiftId} = ${shifts.id})`);
  if (filters.missingPhotos) {
    conditions.push(
      sql`(select count(*) from ${shiftPhotos} where ${shiftPhotos.shiftId} = ${shifts.id} and ${inArray(shiftPhotos.slot, [...EXPECTED_SHIFT_PHOTOS])}) < ${EXPECTED_SHIFT_PHOTOS.length}`,
    );
  }
  return conditions;
}

/** Every depot, courier and bus with an in-scope shift in either view, archived ones included. */
async function reviewOptions(scope: ReviewScope, inViews: SQL): Promise<ReviewOptions> {
  const rows = await db
    .selectDistinct({ depotId: depots.id, depotName: depots.name, carId: cars.id, plate: cars.plate, userId: shifts.userId })
    .from(shifts)
    .innerJoin(depots, eq(depots.id, shifts.depotId))
    .innerJoin(cars, eq(cars.id, shifts.carId))
    .where(inScope(scope, inViews));
  const names = await userNames(rows.map((r) => r.userId));
  const depotList = new Map(rows.map((r) => [r.depotId, { id: r.depotId, name: r.depotName }]));
  const busList = new Map(rows.map((r) => [r.carId, { id: r.carId, plate: r.plate }]));
  const courierList = new Map(rows.map((r) => [r.userId, { userId: r.userId, name: names.get(r.userId) ?? "" }]));
  return {
    depots: [...depotList.values()].sort((a, b) => a.name.localeCompare(b.name)),
    couriers: [...courierList.values()].sort((a, b) => a.name.localeCompare(b.name)),
    buses: [...busList.values()].sort((a, b) => a.plate.localeCompare(b.plate)),
  };
}

/** One shift in scope with its courier's user ID, or null. */
export async function shiftInScope(scope: ReviewScope, id: string): Promise<{ shift: Shift; userId: string } | null> {
  const [row] = await selectShifts().where(inScope(scope, eq(shifts.id, id)));
  return row ? { shift: toShift(row), userId: row.shift.userId } : null;
}

/** Everything the detail screen needs: the shift, its courier, pay at the day's rate, history and edit options. */
export async function reviewDetail(scope: ReviewScope, id: string) {
  const found = await shiftInScope(scope, id);
  if (!found) return null;
  const { shift, userId } = found;

  const [schedule, rules, changeRows, stations, buses, { photos, expiredPhotos }] = await Promise.all([
    payScheduleOf(scope.firmId, userId),
    loadRules(scope.firmId),
    db
      .select()
      .from(shiftChanges)
      .where(and(eq(shiftChanges.firmId, scope.firmId), eq(shiftChanges.shiftId, id)))
      .orderBy(asc(shiftChanges.changedAt)),
    scopeStations(scope),
    activeBusesOf(scope.firmId),
    shiftPhotoState(scope.firmId, id),
  ]);
  const names = await userNames([userId, ...changeRows.map((c) => c.changedBy)]);

  // Pay and Spesen as they will be once approved: the same per-shift math as the monthly totals.
  const rate = rateFor(shift.date, schedule);
  const asApproved = { ...shift, status: "approved" as const };
  const pay = rate
    ? {
        kind: rate.kind,
        amountMinor: rate.amountMinor,
        payMinor: shiftPay(asApproved, schedule),
        spesenMinor: shiftSpesen(asApproved, rules),
      }
    : null;

  const changes: ShiftChange[] = changeRows.map((c) => ({
    field: c.field as ShiftField,
    from: c.oldValue,
    to: c.newValue,
    byName: names.get(c.changedBy) ?? "",
    at: c.changedAt.toISOString(),
  }));

  return { shift, courierName: names.get(userId) ?? "", pay, changes, stations, buses, photos, expiredPhotos };
}

/** Active depots the reviewer may move a shift to. */
export async function scopeStations(scope: ReviewScope): Promise<Station[]> {
  const filter =
    scope.depotIds === "all" ? undefined : scope.depotIds.length ? inArray(depots.id, scope.depotIds) : sql`false`;
  return db
    .select({ id: depots.id, name: depots.name })
    .from(depots)
    .where(and(eq(depots.firmId, scope.firmId), isNull(depots.archivedAt), filter))
    .orderBy(depots.name);
}

async function activeBusesOf(firmId: string): Promise<Bus[]> {
  return db
    .select({ id: cars.id, plate: cars.plate })
    .from(cars)
    .where(and(eq(cars.firmId, firmId), isNull(cars.archivedAt)))
    .orderBy(cars.plate);
}

/** Approves or rejects a submitted shift in scope. Null when it's gone from scope or no longer submitted. */
export async function review(
  scope: ReviewScope,
  id: string,
  decision: { status: "approved" } | { status: "rejected"; reasons: RejectReason[]; note: string | null },
): Promise<Shift | null> {
  const updated = await db
    .update(shifts)
    .set({
      status: decision.status,
      rejectionReasons: decision.status === "rejected" ? decision.reasons : null,
      rejectionNote: decision.status === "rejected" ? decision.note : null,
      reviewedAt: sql`now()`,
      reviewedBy: scope.userId,
      updatedAt: sql`now()`,
    })
    .where(inScope(scope, eq(shifts.id, id), eq(shifts.status, "submitted")))
    .returning({ id: shifts.id });
  return updated.length ? ((await shiftInScope(scope, id))?.shift ?? null) : null;
}

/**
 * Writes a correction and one shift_changes row per changed field, atomically: the change rows are inserted only
 * when the update itself applied (matched by its own updated_at stamp). Null when the shift left scope or status.
 */
export async function correct(
  scope: ReviewScope,
  current: Shift,
  values: ShiftValues,
  names: { stations: Station[]; buses: Bus[] },
): Promise<Shift | null> {
  const after: Shift = {
    ...current,
    depot: values.depotId
      ? { id: values.depotId, name: names.stations.find((s) => s.id === values.depotId)?.name ?? "" }
      : current.depot,
    car: values.carId
      ? { id: values.carId, plate: names.buses.find((b) => b.id === values.carId)?.plate ?? "", vin: null }
      : current.car,
    startedAt: values.startedAt?.toISOString() ?? current.startedAt,
    finishedAt: values.finishedAt?.toISOString() ?? current.finishedAt,
    startKm: values.startKm ?? current.startKm,
    endKm: values.endKm === undefined ? current.endKm : values.endKm,
    loaded: values.loaded ?? current.loaded,
    returned: values.returned === undefined ? current.returned : values.returned,
    pickups: values.pickups === undefined ? current.pickups : values.pickups,
  };
  const changes = diffShift(current, after);
  if (changes.length === 0) return current;

  const stamp = new Date().toISOString();
  const update = db
    .update(shifts)
    .set({ ...values, updatedAt: new Date(stamp) })
    .where(inScope(scope, eq(shifts.id, current.id), inArray(shifts.status, ["submitted", "approved"])))
    .returning({ id: shifts.id });
  const inserts = changes.map(
    (c) => sql`
      insert into ${shiftChanges} (firm_id, shift_id, changed_by, field, old_value, new_value)
      select ${scope.firmId}, ${shifts.id}, ${scope.userId}, ${c.field}, ${c.from}, ${c.to}
      from ${shifts} where ${shifts.id} = ${current.id} and ${shifts.updatedAt} = ${stamp}::timestamptz`,
  );
  const [applied] = await db.batch([update, ...inserts.map((q) => db.execute(q))]);
  if (applied.length === 0) return null;
  return (await shiftInScope(scope, current.id))?.shift ?? null;
}
