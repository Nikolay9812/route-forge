// Hand-calculated salary months. Run with `node --no-warnings scripts/check-salary.mjs` (Node 23.6+ strips the
// TypeScript types). A: the month from prompts/06-home.md on the firm default only (a mid-month rate change, a
// rejected and a submitted shift). B: prompts/13-pay-rates.md, a courier override to a day rate and back. Both
// without a work rule (no break, no Spesen). C: prompts/22-firm-settings-breaks-spesen.md, law breaks and Spesen.
import assert from "node:assert/strict";

import { LAW_DEFAULTS } from "../src/domain/firm.ts";
import { breakFor, monthTotals, nextRate, payDays, rateFor, ratesIn, ruleFor, shiftPay } from "../src/domain/salary.ts";

const hourly = (effectiveFrom, amountMinor) => ({ effectiveFrom, kind: "hourly", amountMinor });

// Breaks as the server fills them: from the rule in force on the shift's day.
const shift = (date, status, minutes, rules = []) => ({
  id: date,
  date,
  status,
  startedAt: `${date}T06:00:00Z`,
  finishedAt: null,
  minutes,
  breakMinutes: breakFor(minutes, ruleFor(date, rules)),
  workedMinutes: minutes - breakFor(minutes, ruleFor(date, rules)),
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
assert.deepEqual(monthTotals(shifts, a, []), {
  approvedMinutes: 1830,
  approvedShifts: 4,
  payMinor: 25900,
  spesenMinor: 0,
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
assert.deepEqual(monthTotals(shifts, b, []), {
  approvedMinutes: 1830,
  approvedShifts: 4,
  payMinor: 36509,
  spesenMinor: 0,
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

// The Pay tab: rates in force in October, and its rows (the rejected shift is left out; pending has no pay).
assert.deepEqual(ratesIn("2026-10-01", "2026-10-31", a), [hourly("2026-10-01", 800), hourly("2026-10-15", 900)]);
assert.deepEqual(ratesIn("2026-10-01", "2026-10-31", b), [
  hourly("2026-10-01", 800),
  { effectiveFrom: "2026-10-10", kind: "daily", amountMinor: 12000 },
  hourly("2026-10-20", 905),
]);
assert.deepEqual(ratesIn("2026-08-01", "2026-08-31", b), []);
const rows = payDays(shifts, b, []);
assert.deepEqual(
  rows.map((d) => [d.date, d.status, d.payMinor]),
  [
    ["2026-10-21", "approved", 6109],
    ["2026-10-20", "submitted", null],
    ["2026-10-15", "approved", 12000],
    ["2026-10-13", "approved", 12000],
    ["2026-10-06", "approved", 6400],
  ],
);
assert.equal(
  rows.reduce((sum, d) => sum + (d.payMinor ?? 0), 0),
  monthTotals(shifts, b, []).payMinor,
);
assert.deepEqual([rows[0].packages, rows[0].km, rows[0].minutes], [100, 50, 405]);

// C: hourly 16.00, 18.00 from the 15th, law breaks and Spesen 14.00 over 8:00 h of shift time.
// 5:50 h no break 350 × 16 = 93.33; 8:00 h − 0:30 = 450 × 16 = 120.00, no Spesen (not over 8:00);
// 9:30 h − 0:45 = 525 × 16 = 140.00 + Spesen; 10:00 h rejected; 8:30 h − 0:30 = 480 × 18 = 144.00 + Spesen.
// → 1805 min (30:05 h), pay 497.33, Spesen 28.00.
const law = [{ effectiveFrom: "2026-01-01", ...LAW_DEFAULTS }];
const c = { firm: [hourly("2026-01-01", 1600), hourly("2026-10-15", 1800)], own: [] };
const month = [
  shift("2026-10-03", "approved", 350, law),
  shift("2026-10-07", "approved", 480, law),
  shift("2026-10-10", "approved", 570, law),
  shift("2026-10-12", "rejected", 600, law),
  shift("2026-10-20", "approved", 510, law),
];
assert.deepEqual(
  month.map((s) => [s.breakMinutes, s.workedMinutes, shiftPay(s, c)]),
  [[0, 350, 9333], [30, 450, 12000], [45, 525, 14000], [45, 555, 0], [30, 480, 14400]],
);
assert.deepEqual(monthTotals(month, c, law), {
  approvedMinutes: 1805,
  approvedShifts: 4,
  payMinor: 49733,
  spesenMinor: 2800,
  packages: 400,
  km: 200,
  pendingCount: 0,
});
assert.deepEqual(
  payDays(month, c, law).map((d) => [d.date, d.minutes, d.breakMinutes, d.payMinor, d.spesenMinor]),
  [
    ["2026-10-20", 480, 30, 14400, 1400],
    ["2026-10-10", 525, 45, 14000, 1400],
    ["2026-10-07", 450, 30, 12000, 0],
    ["2026-10-03", 350, 0, 9333, 0],
  ],
);
// A rule from the 15th with a 15-min break reaches only the 20th: 495 × 18 = 148.50.
const shorter = [...law, { ...law[0], effectiveFrom: "2026-10-15", breakMinutes: 15 }];
const withShorter = month.map((s) => shift(s.date, s.status, s.minutes, shorter));
assert.deepEqual(withShorter.map((s) => s.breakMinutes), [0, 30, 45, 45, 15]);
assert.equal(monthTotals(withShorter, c, shorter).payMinor, 9333 + 12000 + 14000 + 14850);

console.log("Salary check OK: A 25900, B 36509, C 49733 + 2800 Spesen over 1805 min.");
