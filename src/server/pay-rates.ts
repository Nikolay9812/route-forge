// Pay rates: the firm default (rows with no user) and each courier's own entries. Every query filters by firm.
// Started entries are history and never change; only upcoming ones can be edited or cancelled.
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { payRates } from "@/db/schema";
import { consistentRate, type RateCreate, type RatePatch } from "@/domain/pay-rates";
import { followsFirm, nextRate, rateFor } from "@/domain/salary";
import type {
  ApiErrorCode,
  Firm,
  PayRateEntry,
  PayRates,
  PayRateTarget,
  PaySchedule,
  Rate,
  RateEntry,
} from "@/domain/types";

import { firmCouriers, userNames } from "./auth";
import { uniqueWrite } from "./fleet";

type Row = typeof payRates.$inferSelect;

function toEntry(row: Row): RateEntry {
  return { effectiveFrom: row.effectiveFrom, kind: row.kind, amountMinor: row.amountMinor };
}

function toRates(rows: readonly Row[]): Rate[] {
  return rows.flatMap((r) =>
    r.kind !== "firm" && r.amountMinor !== null
      ? [{ effectiveFrom: r.effectiveFrom, kind: r.kind, amountMinor: r.amountMinor }]
      : [],
  );
}

function scheduleOf(rows: readonly Row[], userId: string | null): PaySchedule {
  return {
    firm: toRates(rows.filter((r) => r.userId === null)),
    own: userId === null ? [] : rows.filter((r) => r.userId === userId).map(toEntry),
  };
}

/** The firm default plus one courier's entries: everything their pay depends on. */
export async function payScheduleOf(firmId: string, userId: string): Promise<PaySchedule> {
  const rows = await db
    .select()
    .from(payRates)
    .where(and(eq(payRates.firmId, firmId), or(isNull(payRates.userId), eq(payRates.userId, userId))));
  return scheduleOf(rows, userId);
}

function targetOf(rows: readonly Row[], userId: string | null, today: string, names: Map<string, string>): PayRateTarget {
  const schedule = scheduleOf(rows, userId);
  const own = rows.filter((r) => r.userId === userId).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const currentId = own.find((r) => r.effectiveFrom <= today)?.id;
  const entries: PayRateEntry[] = own.map((r) => ({
    ...toEntry(r),
    id: r.id,
    upcoming: r.effectiveFrom > today,
    current: r.id === currentId,
    setByName: names.get(r.setBy) ?? "",
    setAt: r.setAt.toISOString(),
  }));
  return {
    current: rateFor(today, schedule),
    next: nextRate(today, schedule),
    followsFirm: userId !== null && followsFirm(today, schedule),
    entries,
  };
}

async function firmRows(firmId: string): Promise<Row[]> {
  return db.select().from(payRates).where(eq(payRates.firmId, firmId));
}

/** The owner's Pay rates screen: the firm default and every courier (members, plus anyone with own entries). */
export async function payRatesOf(firmId: string, firm: Firm, today: string): Promise<PayRates> {
  const [rows, members] = await Promise.all([firmRows(firmId), firmCouriers(firmId)]);
  const userIds = [...new Set([...members, ...rows.flatMap((r) => (r.userId ? [r.userId] : []))])];
  const names = await userNames([...userIds, ...rows.map((r) => r.setBy)]);
  const couriers = userIds
    .map((userId) => ({ userId, name: names.get(userId) ?? "", ...targetOf(rows, userId, today, names) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { firm, today, firmDefault: targetOf(rows, null, today, names), couriers };
}

/** One target's view after a write: the firm default (null) or a courier. */
export async function payRateTarget(firmId: string, userId: string | null, today: string): Promise<PayRateTarget> {
  const rows = await firmRows(firmId);
  const names = await userNames(rows.map((r) => r.setBy));
  return targetOf(rows, userId, today, names);
}

/** A courier the owner may set rates for: a courier member of this firm, or someone with entries in it already. */
async function isFirmCourier(firmId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: payRates.id })
    .from(payRates)
    .where(and(eq(payRates.firmId, firmId), isNotNull(payRates.userId), eq(payRates.userId, userId)))
    .limit(1);
  return Boolean(row) || (await firmCouriers(firmId)).includes(userId);
}

export async function createRate(firmId: string, ownerId: string, input: RateCreate): Promise<Row | ApiErrorCode> {
  if (input.userId !== null && !(await isFirmCourier(firmId, input.userId))) return "invalid";
  return uniqueWrite(async () => {
    const [row] = await db
      .insert(payRates)
      .values({ firmId, ...input, setBy: ownerId })
      .returning();
    return row;
  });
}

async function upcomingRow(firmId: string, id: string, today: string): Promise<Row | ApiErrorCode> {
  const [row] = await db
    .select()
    .from(payRates)
    .where(and(eq(payRates.firmId, firmId), eq(payRates.id, id)));
  if (!row) return "notFound";
  return row.effectiveFrom > today ? row : "notEditable";
}

export async function updateRate(
  firmId: string,
  ownerId: string,
  id: string,
  patch: RatePatch,
  today: string,
): Promise<Row | ApiErrorCode> {
  const row = await upcomingRow(firmId, id, today);
  if (typeof row === "string") return row;
  const kind = patch.kind ?? row.kind;
  // Switching to "follow the firm default" drops the amount unless the patch says otherwise.
  const amountMinor = "amountMinor" in patch ? (patch.amountMinor ?? null) : kind === "firm" ? null : row.amountMinor;
  if (!consistentRate(row.userId, kind, amountMinor)) return "invalid";
  return uniqueWrite(async () => {
    const [updated] = await db
      .update(payRates)
      .set({ effectiveFrom: patch.effectiveFrom ?? row.effectiveFrom, kind, amountMinor, setBy: ownerId, setAt: new Date() })
      .where(and(eq(payRates.firmId, firmId), eq(payRates.id, id)))
      .returning();
    return updated;
  });
}

/** Cancels an upcoming entry. No shift's pay depended on it yet, so the row is removed. */
export async function deleteRate(firmId: string, id: string, today: string): Promise<Row | ApiErrorCode> {
  const row = await upcomingRow(firmId, id, today);
  if (typeof row === "string") return row;
  await db.delete(payRates).where(and(eq(payRates.firmId, firmId), eq(payRates.id, id)));
  return row;
}
