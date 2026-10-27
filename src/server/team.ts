// The Team tab for dispatchers and owners: the couriers a reviewer may see and their month calendars.
// Owners see every courier member of the firm plus anyone with shifts in it; dispatchers see couriers with shifts
// in their depots. Shift reads go through inScope(), so a dispatcher never sees another depot's shifts.
import { asc, count, eq, gte, lte, min, sql } from "drizzle-orm";

import { db } from "@/db";
import { shifts } from "@/db/schema";
import { monthOf } from "@/domain/dates";
import type { CalendarMonth, Firm } from "@/domain/types";

import { inScope, type ReviewScope } from "./approvals";
import { firmCouriers, userNames } from "./auth";
import { calendarMonth, monthRange } from "./calendar";
import { memberIds } from "./people";
import { selectShifts, toShift } from "./shifts";
import { breakMinutesSql } from "./work-rules";

export type TeamMember = {
  userId: string;
  name: string;
  /** This month, in the reviewer's scope. */
  shifts: number;
  /** Worked time (after the break) of this month's submitted and approved shifts. */
  minutes: number;
  /** Submitted shifts waiting for review this month. */
  waiting: number;
  /** No longer a member of the firm (removed); their shifts stay. */
  former: boolean;
};

/** User IDs of everyone with a shift in scope, plus (owners only) the firm's courier members. */
async function teamIds(scope: ReviewScope): Promise<Set<string>> {
  const rows = await db.selectDistinct({ userId: shifts.userId }).from(shifts).where(inScope(scope));
  const ids = new Set(rows.map((r) => r.userId));
  if (scope.depotIds === "all") for (const id of await firmCouriers(scope.firmId)) ids.add(id);
  return ids;
}

export async function teamList(scope: ReviewScope, today: string): Promise<TeamMember[]> {
  const [from, to] = monthRange(monthOf(today));
  const [ids, members, totals] = await Promise.all([
    teamIds(scope),
    memberIds(scope.firmId),
    db
      .select({
        userId: shifts.userId,
        shifts: count(),
        minutes: sql<number>`coalesce(sum(${shifts.minutes} - ${breakMinutesSql}) filter (where ${shifts.status} in ('submitted', 'approved')), 0)::int`,
        waiting: sql<number>`(count(*) filter (where ${shifts.status} = 'submitted'))::int`,
      })
      .from(shifts)
      .where(inScope(scope, gte(shifts.date, from), lte(shifts.date, to)))
      .groupBy(shifts.userId),
  ]);
  const byUser = new Map(totals.map((t) => [t.userId, t]));
  const names = await userNames([...ids]);
  return [...ids]
    .map((userId) => {
      const t = byUser.get(userId);
      return {
        userId,
        name: names.get(userId) ?? "",
        shifts: t?.shifts ?? 0,
        minutes: t?.minutes ?? 0,
        waiting: t?.waiting ?? 0,
        former: !members.has(userId),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One courier's month in the reviewer's scope, or null when the courier isn't on the reviewer's team. */
export async function courierMonth(
  scope: ReviewScope,
  firm: Firm,
  today: string,
  userId: string,
  month: string,
): Promise<(CalendarMonth & { courierName: string }) | null> {
  if (!(await teamIds(scope)).has(userId)) return null;
  const [from, to] = monthRange(month);
  const [rows, [first], names] = await Promise.all([
    selectShifts()
      .where(inScope(scope, eq(shifts.userId, userId), gte(shifts.date, from), lte(shifts.date, to)))
      .orderBy(asc(shifts.date)),
    db.select({ first: min(shifts.date) }).from(shifts).where(inScope(scope, eq(shifts.userId, userId))),
    userNames([userId]),
  ]);
  return {
    ...calendarMonth(firm, today, month, rows.map(toShift), first?.first ?? null),
    courierName: names.get(userId) ?? "",
  };
}
