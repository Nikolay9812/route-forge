// Hand-calculated salary month from prompts/06-home.md: a mid-month rate change, a rejected and a
// submitted shift. Run with `node --no-warnings scripts/check-salary.mjs` (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import { monthTotals, shiftPay } from "../src/domain/salary.ts";

const rates = [
  { effectiveFrom: "2026-09-01", hourlyMinor: 750 },
  { effectiveFrom: "2026-10-01", hourlyMinor: 800 },
  { effectiveFrom: "2026-10-15", hourlyMinor: 900 },
];

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

assert.deepEqual(
  shifts.map((s) => shiftPay(s, rates)),
  [6400, 6000, 0, 7425, 0, 6075],
);
assert.deepEqual(monthTotals(shifts, rates), {
  approvedMinutes: 1830,
  payMinor: 25900,
  packages: 400,
  km: 200,
  pendingCount: 1,
});

console.log("Salary check OK: 1830 min (30.5 h), 25900 minor units, 1 pending.");
