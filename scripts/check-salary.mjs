// Hand-calculated salary months. Run with `node --no-warnings scripts/check-salary.mjs` (Node 23.6+ strips the
// TypeScript types). A: the month from prompts/06-home.md on the firm default only (a mid-month rate change, a
// rejected and a submitted shift). B: prompts/13-pay-rates.md, a courier override to a day rate and back.
import assert from "node:assert/strict";

import { monthTotals, nextRate, rateFor, shiftPay } from "../src/domain/salary.ts";

const hourly = (effectiveFrom, amountMinor) => ({ effectiveFrom, kind: "hourly", amountMinor });

const shift = (date, status, minutes) => ({
  id: date,
  date,
  status,
  startedAt: `${date}T06:00:00Z`,
  finishedAt: null,
  minutes,
  depot: { id: "d", name: "Sofia" },
  car: { id: "c", plate: "CA 1234 AB" },
  startKm: 1000,
  endKm: 1050,
  loaded: 110,
  returned: 10,
  pickups: 0,
});

const shifts = [
  shift("2026-10-06", "approved", 480),
  shift("2026-10-13", "approved", 450),
  shift("2026-10-14", "rejected", 500),
  shift("2026-10-15", "approved", 495),
  shift("2026-10-20", "submitted", 480),
  shift("2026-10-21", "approved", 405),
];

// A: 480 × 8.00 = 64.00, 450 × 8.00 = 60.00, 495 × 9.00 = 74.25, 405 × 9.00 = 60.75 → 259.00.
const a = {
  firm: [hourly("2026-09-01", 750), hourly("2026-10-01", 800), hourly("2026-10-15", 900)],
  own: [],
};
assert.deepEqual(
  shifts.map((s) => shiftPay(s, a)),
  [6400, 6000, 0, 7425, 0, 6075],
);
assert.deepEqual(monthTotals(shifts, a), {
  approvedMinutes: 1830,
  approvedShifts: 4,
  payMinor: 25900,
  packages: 400,
  km: 200,
  pendingCount: 1,
});

// B: firm 8.00/h, 9.05/h from the 15th; the courier is on a 120.00 day rate from the 10th and follows the firm
// again from the 20th. 480 × 8.00 = 64.00, day rate 120.00 twice, 405 × 9.05 = 61.0875 → 61.09 → 365.09.
const b = {
  firm: [hourly("2026-09-01", 800), hourly("2026-10-15", 905)],
  own: [
    { effectiveFrom: "2026-10-10", kind: "daily", amountMinor: 12000 },
    { effectiveFrom: "2026-10-20", kind: "firm", amountMinor: null },
  ],
};
assert.deepEqual(
  shifts.map((s) => shiftPay(s, b)),
  [6400, 12000, 0, 12000, 0, 6109],
);
assert.deepEqual(monthTotals(shifts, b), {
  approvedMinutes: 1830,
  approvedShifts: 4,
  payMinor: 36509,
  packages: 400,
  km: 200,
  pendingCount: 1,
});

// Before any rate: no rate, no pay. The next change seen from the 12th is the firm default from the 20th.
assert.equal(rateFor("2026-08-31", b), null);
assert.equal(shiftPay(shift("2026-08-31", "approved", 480), b), 0);
assert.deepEqual(nextRate("2026-10-05", b), { effectiveFrom: "2026-10-10", kind: "daily", amountMinor: 12000 });
// The firm's change on the 15th doesn't reach a day-rate courier; following the firm again on the 20th does.
assert.deepEqual(nextRate("2026-10-12", b), hourly("2026-10-20", 905));
assert.equal(nextRate("2026-10-21", b), null);

console.log("Salary check OK: A 25900 and B 36509 minor units over 1830 min, 4 approved, 1 pending.");
