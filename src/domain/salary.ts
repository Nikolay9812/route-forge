// Salary math, shared by API routes and the app. Pure and import-free at runtime so Node can run it
// directly (scripts/check-salary.mjs). Pay counts approved shifts only and is never stored.
import type { Rate, Shift } from "./types";

export type MonthTotals = {
  approvedMinutes: number;
  payMinor: number;
  packages: number;
  km: number;
  /** Submitted shifts still waiting for a dispatcher. */
  pendingCount: number;
};

/** The rate with the latest effectiveFrom on or before the date, so a rate change never rewrites past days. */
export function rateFor(date: string, rates: readonly Rate[]): Rate | null {
  let match: Rate | null = null;
  for (const rate of rates) {
    if (rate.effectiveFrom <= date && (!match || rate.effectiveFrom > match.effectiveFrom)) match = rate;
  }
  return match;
}

/** Rounded per shift, half up, in minor units. Anything but an approved shift pays 0. */
export function shiftPay(shift: Shift, rates: readonly Rate[]): number {
  if (shift.status !== "approved") return 0;
  const rate = rateFor(shift.date, rates);
  return rate ? Math.round((shift.minutes * rate.hourlyMinor) / 60) : 0;
}

export function monthTotals(shifts: readonly Shift[], rates: readonly Rate[]): MonthTotals {
  const totals: MonthTotals = { approvedMinutes: 0, payMinor: 0, packages: 0, km: 0, pendingCount: 0 };
  for (const shift of shifts) {
    if (shift.status === "submitted") totals.pendingCount += 1;
    if (shift.status !== "approved") continue;
    totals.approvedMinutes += shift.minutes;
    totals.payMinor += shiftPay(shift, rates);
    totals.packages += shift.packages;
    totals.km += shift.km;
  }
  return totals;
}
