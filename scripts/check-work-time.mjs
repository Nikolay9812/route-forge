// Pure work-rule checks: the automatic break, Spesen, which rule applies on a day, and the owner's input rules.
// Run with `npm run check:work-time` (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import { LAW_DEFAULTS, parseClock, parseRule, parseSettings } from "../src/domain/firm.ts";
import { breakFor, ruleFor, spesenFor } from "../src/domain/salary.ts";

const law = { effectiveFrom: "2026-01-01", ...LAW_DEFAULTS };

// "Over" is strict: exactly 6:00 h, 9:00 h and 8:00 h don't reach the next step.
assert.deepEqual(
  [0, 359, 360, 361, 370, 539, 540, 541, 600].map((m) => breakFor(m, law)),
  [0, 0, 0, 30, 30, 30, 30, 45, 45],
);
assert.deepEqual(
  [479, 480, 481, 600].map((m) => spesenFor(m, law)),
  [0, 0, 1400, 1400],
);
assert.equal(breakFor(600, null), 0);
assert.equal(spesenFor(600, null), 0);
assert.equal(spesenFor(600, { ...law, spesenMinor: 0 }), 0);

// The latest entry on or before the day; nothing before the first one.
const later = { ...law, effectiveFrom: "2026-10-15", breakMinutes: 15 };
const rules = [later, law];
assert.equal(ruleFor("2025-12-31", rules), null);
assert.equal(ruleFor("2026-10-14", rules), law);
assert.equal(ruleFor("2026-10-15", rules), later);
assert.equal(breakFor(400, ruleFor("2026-10-20", rules)), 15);

// Input: every field, saved whole; the longer break starts later and lasts at least as long.
assert.deepEqual(parseRule(law), { ok: true, value: law });
assert.equal(parseRule({ ...law, extra: 1 }).ok, false);
const { spesenMinor: _dropped, ...missing } = law;
assert.equal(parseRule(missing).ok, false);
assert.equal(parseRule({ ...law, effectiveFrom: "2026-02-30" }).ok, false);
assert.equal(parseRule({ ...law, longBreakAfterMinutes: 360 }).ok, false);
assert.equal(parseRule({ ...law, longBreakMinutes: 20 }).ok, false);
assert.equal(parseRule({ ...law, breakMinutes: 121, longBreakMinutes: 121 }).ok, false);
assert.equal(parseRule({ ...law, breakAfterMinutes: 30 }).ok, false);
assert.equal(parseRule({ ...law, spesenMinor: -1 }).ok, false);
assert.equal(parseRule({ ...law, spesenMinor: 14.5 }).ok, false);
assert.equal(parseRule({ ...law, breakMinutes: 0, longBreakMinutes: 0, spesenMinor: 0 }).ok, true);

assert.deepEqual([parseClock("6:00"), parseClock("9.30"), parseClock(" 8:05 "), parseClock("6:60"), parseClock("6")], [
  360,
  570,
  485,
  null,
  null,
]);

assert.deepEqual(parseSettings({ currency: "EUR", timeZone: "Europe/Berlin" }), {
  ok: true,
  value: { currency: "EUR", timeZone: "Europe/Berlin" },
});
assert.equal(parseSettings({ currency: "BGN", timeZone: "Europe/Berlin" }).ok, false);
assert.equal(parseSettings({ currency: "EUR", timeZone: "Mars/Olympus" }).ok, false);
assert.equal(parseSettings({ currency: "EUR", timeZone: "Europe/Berlin", name: "x" }).ok, false);

console.log("Work-time check OK: breaks, Spesen, rule dates and input rules.");
