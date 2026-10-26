// Salary math, shared by API routes and the app. Pure and import-free at runtime so Node can run it
// directly (scripts/check-salary.mjs). Pay counts approved shifts only and is never stored.
import type { PayDay, PaySchedule, Rate, RateEntry, Shift } from "./types";

export type MonthTotals = {
  approvedMinutes: number;
  approvedShifts: number;
  payMinor: number;
  /** Delivered packages. */
  packages: number;
  km: number;
  /** Submitted shifts still waiting for a dispatcher. */
  pendingCount: number;
};

/** The entry with the latest effectiveFrom on or before the date. */
function latestOn<T extends { effectiveFrom: string }>(date: string, entries: readonly T[]): T | null {
  let match: T | null = null;
  for (const entry of entries) {
    if (entry.effectiveFrom <= date && (!match || entry.effectiveFrom > match.effectiveFrom)) match = entry;
  }
  return match;
}

function asRate(entry: RateEntry): Rate | null {
  return entry.kind === "firm" || entry.amountMinor === null
    ? null
    : { effectiveFrom: entry.effectiveFrom, kind: entry.kind, amountMinor: entry.amountMinor };
}

/**
 * The rate in force on a day: the courier's latest own entry on or before it, else (or when that entry says
 * "follow the firm default") the firm default's latest. A change never rewrites days before it starts.
 */
export function rateFor(date: string, schedule: PaySchedule): Rate | null {
  const own = latestOn(date, schedule.own);
  if (own && own.kind !== "firm") return asRate(own);
  return latestOn(date, schedule.firm);
}

/** True when the courier's pay on that day comes from the firm default (or nothing). */
export function followsFirm(date: string, schedule: PaySchedule): boolean {
  const own = latestOn(date, schedule.own);
  return !own || own.kind === "firm";
}

function sameRate(a: Rate | null, b: Rate | null): boolean {
  return a?.kind === b?.kind && a?.amountMinor === b?.amountMinor;
}

/** The first scheduled change after `today` that pays differently, dated from the day it starts. */
export function nextRate(today: string, schedule: PaySchedule): Rate | null {
  const current = rateFor(today, schedule);
  const days = [...new Set([...schedule.firm, ...schedule.own].map((e) => e.effectiveFrom))]
    .filter((day) => day > today)
    .sort();
  for (const day of days) {
    const rate = rateFor(day, schedule);
    if (!sameRate(rate, current)) return rate ? { ...rate, effectiveFrom: day } : null;
  }
  return null;
}

/**
 * The rates in force from `first` to `last` (calendar days): the one on `first`, then each day it changes, dated
 * from that day. Days with no rate are skipped.
 */
export function ratesIn(first: string, last: string, schedule: PaySchedule): Rate[] {
  const days = [...new Set([...schedule.firm, ...schedule.own].map((e) => e.effectiveFrom))]
    .filter((day) => day > first && day <= last)
    .sort();
  const rates: Rate[] = [];
  let previous: Rate | null = null;
  for (const day of [first, ...days]) {
    const rate = rateFor(day, schedule);
    if (rate && !sameRate(rate, previous)) rates.push({ ...rate, effectiveFrom: day });
    previous = rate;
  }
  return rates;
}

/** Rounded per shift, half up, in minor units. Anything but an approved shift pays 0. */
export function shiftPay(shift: Shift, schedule: PaySchedule): number {
  if (shift.status !== "approved") return 0;
  const rate = rateFor(shift.date, schedule);
  if (!rate) return 0;
  return rate.kind === "daily" ? rate.amountMinor : Math.round(((shift.minutes ?? 0) * rate.amountMinor) / 60);
}

export function monthTotals(shifts: readonly Shift[], schedule: PaySchedule): MonthTotals {
  const totals: MonthTotals = {
    approvedMinutes: 0,
    approvedShifts: 0,
    payMinor: 0,
    packages: 0,
    km: 0,
    pendingCount: 0,
  };
  for (const shift of shifts) {
    if (shift.status === "submitted") totals.pendingCount += 1;
    if (shift.status !== "approved") continue;
    totals.approvedMinutes += shift.minutes ?? 0;
    totals.approvedShifts += 1;
    totals.payMinor += shiftPay(shift, schedule);
    // Same as delivered() and kmDriven() in shift.ts, inlined: domain files share only types at runtime.
    totals.packages += shift.loaded - (shift.returned ?? 0);
    totals.km += (shift.endKm ?? shift.startKm) - shift.startKm;
  }
  return totals;
}

/** The Pay tab's rows: approved and submitted shifts, newest first. Only approved ones carry pay. */
export function payDays(shifts: readonly Shift[], schedule: PaySchedule): PayDay[] {
  const days: PayDay[] = [];
  for (const shift of shifts) {
    if (shift.status !== "approved" && shift.status !== "submitted") continue;
    days.push({
      shiftId: shift.id,
      date: shift.date,
      status: shift.status,
      minutes: shift.minutes ?? 0,
      packages: shift.loaded - (shift.returned ?? 0),
      km: (shift.endKm ?? shift.startKm) - shift.startKm,
      payMinor: shift.status === "approved" ? shiftPay(shift, schedule) : null,
    });
  }
  return days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
