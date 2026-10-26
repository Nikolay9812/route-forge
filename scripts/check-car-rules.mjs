// Hand-checked rules for car papers and the talon photo (prompts/19). Run with `npm run check:car-rules`
// (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import { carWarnings, lastDayOfMonth, normalizeVin, parseCarPapers, parseCarPatch, validVin } from "../src/domain/fleet.ts";
import {
  carPhotoPrefix,
  carPhotoSlots,
  isPhotoKey,
  parseCarPhotoConfirm,
  parseCarPhotoQuery,
  parseCarPhotoRequest,
} from "../src/domain/photos.ts";

// VIN: 17 of A–Z and 0–9 without I, O, Q; spaces and hyphens dropped, uppercased.
assert.equal(validVin("ZFA250006SMC06228"), "ZFA250006SMC06228");
assert.equal(validVin("  zfa 250006 smc-06228 "), "ZFA250006SMC06228");
assert.equal(normalizeVin("wvw zzz"), "WVWZZZ");
assert.equal(validVin("ZFA250006SMC0622"), null, "16 characters");
assert.equal(validVin("ZFA250006SMC062281"), null, "18 characters");
for (const letter of ["I", "O", "Q"]) assert.equal(validVin(`ZFA250006SMC0622${letter}`), null, `no ${letter}`);
assert.equal(validVin("ZFA250006SMC0622Ä"), null, "Latin only");
assert.equal(validVin(12345678901234567), null);

// TÜV month → its last day, including February in a leap year.
assert.equal(lastDayOfMonth("2027-03"), "2027-03-31");
assert.equal(lastDayOfMonth("2028-02"), "2028-02-29");
assert.equal(lastDayOfMonth("2027-02"), "2027-02-28");
assert.equal(lastDayOfMonth("2026-12"), "2026-12-31");

// Papers: exactly the five fields, each null or valid.
const none = { vin: null, tuvDue: null, insuranceExpiresOn: null, serviceDueOn: null, serviceDueKm: null };
assert.deepEqual(parseCarPapers(none), { ok: true, value: none });
const full = {
  vin: "zfa250006smc06228",
  tuvDue: "2027-03",
  insuranceExpiresOn: "2027-01-31",
  serviceDueOn: "2027-06-01",
  serviceDueKm: 200000,
};
assert.deepEqual(parseCarPapers(full), { ok: true, value: { ...full, vin: "ZFA250006SMC06228" } });
for (const bad of [
  { ...none, vin: "SHORT" },
  { ...none, tuvDue: "2027-13" },
  { ...none, tuvDue: "2027-3" },
  { ...none, tuvDue: "2027-03-31" },
  { ...none, insuranceExpiresOn: "2027-02-30" },
  { ...none, serviceDueOn: "tomorrow" },
  { ...none, serviceDueKm: -1 },
  { ...none, serviceDueKm: 1.5 },
  { ...none, serviceDueKm: "1000" },
  { ...none, serviceDueKm: 10_000_000 },
  { ...none, extra: 1 },
  { vin: null },
  null,
  [],
]) {
  assert.equal(parseCarPapers(bad).ok, false, JSON.stringify(bad));
}

// Patch: papers alone, never mixed with a plate, depot or archive.
assert.deepEqual(parseCarPatch({ papers: none }), { ok: true, value: { papers: none } });
assert.equal(parseCarPatch({ papers: none, plate: "B X 1" }).ok, false);
assert.equal(parseCarPatch({ papers: none, archived: true }).ok, false);
assert.equal(parseCarPatch({ papers: { ...none, vin: "x" } }).ok, false);
assert.equal(parseCarPatch({ plate: "b x 1" }).ok, true);

// Warnings: 30 days for dates (TÜV through its month's last day), 1,000 km for the service km.
const today = "2026-10-26";
const car = (papers, odometerKm = null) => ({ papers: { ...none, ...papers }, odometerKm });
assert.deepEqual(carWarnings(car({}), today), []);
assert.deepEqual(carWarnings(car({ tuvDue: "2026-10" }), today), [{ kind: "tuv", level: "soon" }], "this month");
assert.deepEqual(carWarnings(car({ tuvDue: "2026-09" }), today), [{ kind: "tuv", level: "due" }]);
assert.deepEqual(carWarnings(car({ tuvDue: "2026-11" }), today), [], "30 Nov is 35 days away");
assert.deepEqual(carWarnings(car({ insuranceExpiresOn: "2026-11-25" }), today), [{ kind: "insurance", level: "soon" }]);
assert.deepEqual(carWarnings(car({ insuranceExpiresOn: "2026-11-26" }), today), [], "31 days");
assert.deepEqual(carWarnings(car({ insuranceExpiresOn: "2026-10-26" }), today), [{ kind: "insurance", level: "soon" }]);
assert.deepEqual(carWarnings(car({ insuranceExpiresOn: "2026-10-25" }), today), [{ kind: "insurance", level: "due" }]);
assert.deepEqual(carWarnings(car({ serviceDueKm: 200000 }, 198999), today), []);
assert.deepEqual(carWarnings(car({ serviceDueKm: 200000 }, 199000), today), [{ kind: "service", level: "soon" }]);
assert.deepEqual(carWarnings(car({ serviceDueKm: 200000 }, 200000), today), [{ kind: "service", level: "due" }]);
assert.deepEqual(carWarnings(car({ serviceDueKm: 200000 }), today), [], "no odometer yet");
assert.deepEqual(
  carWarnings(car({ serviceDueOn: "2026-11-01", serviceDueKm: 200000 }, 201000), today),
  [{ kind: "service", level: "due" }],
  "the worse of date and km",
);
assert.deepEqual(
  carWarnings(car({ tuvDue: "2026-09", insuranceExpiresOn: "2026-11-01", serviceDueOn: "2026-10-01" }), today),
  [
    { kind: "tuv", level: "due" },
    { kind: "insurance", level: "soon" },
    { kind: "service", level: "due" },
  ],
);

// Photos: one talon slot, keys under the car's prefix.
assert.deepEqual(carPhotoSlots, ["talon"]);
assert.deepEqual(parseCarPhotoRequest({ slot: "talon", contentType: "image/jpeg" }), {
  ok: true,
  value: { slot: "talon", contentType: "image/jpeg" },
});
assert.equal(parseCarPhotoRequest({ slot: "front", contentType: "image/jpeg" }).ok, false);
assert.equal(parseCarPhotoRequest({ slot: "talon", contentType: "application/pdf" }).ok, false);
assert.equal(parseCarPhotoRequest({ slot: "talon", contentType: "image/png", carId: "x" }).ok, false);
assert.equal(parseCarPhotoConfirm({ slot: "talon", key: "k" }).ok, true);
assert.equal(parseCarPhotoConfirm({ slot: "talon" }).ok, false);
assert.equal(parseCarPhotoQuery(new URLSearchParams("slot=talon")).ok, true);
assert.equal(parseCarPhotoQuery(new URLSearchParams("slot=constructor")).ok, false);
const prefix = carPhotoPrefix("org_1", "car-1", "talon");
assert.equal(prefix, "firms/org_1/cars/car-1/talon/");
assert.equal(isPhotoKey(`${prefix}0b7c3f1e-1d2a-4c3b-9e8f-123456789abc`, prefix), true);
assert.equal(isPhotoKey(`firms/org_1/cars/car-2/talon/0b7c3f1e-1d2a-4c3b-9e8f-123456789abc`, prefix), false);

console.log("car rules ok");
