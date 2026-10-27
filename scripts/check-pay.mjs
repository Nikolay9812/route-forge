// Pay tab checks against a running dev server: couriers see only their own months, reviewers get `role`, no firm
// sees another, and the rows add up to the approved totals. Read-only.
// Run with `npm run check:pay` (after db:seed).
import { addMonths } from "../src/domain/calendar.ts";

import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
const token = {
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

// Courier: own months.
let r = await call(token.a, "GET", "/api/pay");
check("courier gets the current month", r.status === 200 && r.json.month === r.json.today.slice(0, 7), r.status);
const current = r.json.month;
const lastMonth = addMonths(current, -1);
check("courier pages back to the seeded start", r.json.firstMonth === addMonths(current, -6), r.json.firstMonth);

const ownIds = new Set(
  (await sql`select id from shifts where user_id = ${users.a} and firm_id = ${ivanov}`).map((row) => row.id),
);
r = await call(token.a, "GET", `/api/pay?month=${lastMonth}`);
const month = r.json;
check("last month answers", r.status === 200 && month.month === lastMonth, r.status);
check("rows are the courier's own", month.days.length > 0 && month.days.every((d) => ownIds.has(d.shiftId)));
check("rows are that month only", month.days.every((d) => d.date.startsWith(lastMonth)));
check("rows are newest first", month.days.every((d, i, all) => i === 0 || all[i - 1].date >= d.date));
check("past months have no upcoming change", month.next === null);

// Rows against a count straight from the database.
const [hand] = await sql`
  select (count(*) filter (where status = 'approved'))::int as approved,
    (count(*) filter (where status = 'submitted'))::int as submitted,
    coalesce(sum(minutes - case when minutes > 540 then 45 when minutes > 360 then 30 else 0 end) filter (where status = 'approved'), 0)::int as minutes,
    coalesce(sum(case when minutes > 480 then 1400 else 0 end) filter (where status = 'approved'), 0)::int as spesen,
    coalesce(sum(loaded - coalesce(returned, 0)) filter (where status = 'approved'), 0)::int as packages,
    coalesce(sum(coalesce(end_km, start_km) - start_km) filter (where status = 'approved'), 0)::int as km
  from shifts where firm_id = ${ivanov} and user_id = ${users.a} and to_char(date, 'YYYY-MM') = ${lastMonth}`;
const approved = month.days.filter((d) => d.status === "approved");
const pending = month.days.filter((d) => d.status === "submitted");
check(
  "approved and pending rows match a hand count",
  approved.length === hand.approved && pending.length === hand.submitted && hand.submitted >= 1,
  JSON.stringify({ approved: approved.length, pending: pending.length, hand }),
);
check("rejected and draft shifts are left out", month.days.every((d) => d.status === "approved" || d.status === "submitted"));
check("pending rows carry no pay", pending.every((d) => d.payMinor === null));
const sum = (key) => approved.reduce((total, d) => total + d[key], 0);
check("approved pay adds up to the total", sum("payMinor") === month.totals.payMinor && month.totals.payMinor > 0);
check(
  "minutes, packages and km add up and match the database",
  sum("minutes") === month.totals.approvedMinutes &&
    sum("minutes") === hand.minutes &&
    sum("packages") === month.totals.packages &&
    sum("packages") === hand.packages &&
    sum("km") === month.totals.km &&
    sum("km") === hand.km,
  JSON.stringify({ totals: month.totals, hand }),
);
check(
  "Spesen adds up and matches the database",
  sum("spesenMinor") === month.totals.spesenMinor && month.totals.spesenMinor === hand.spesen && hand.spesen > 0,
  JSON.stringify({ spesen: month.totals.spesenMinor, hand: hand.spesen }),
);
check("pending rows carry no Spesen", pending.every((d) => d.spesenMinor === null));
check("the month has a rate", month.rates.length >= 1, month.rates.length);

// Recent months: the 5 before the current one, newest first, the same in every answer.
const recent = month.recentMonths;
check(
  "5 recent months, newest first, before the current one",
  recent.length === 5 && recent.every((m, i) => m.month === addMonths(current, -1 - i)),
  recent.map((m) => m.month).join(),
);
check(
  "last month's row matches last month's totals",
  recent[0].payMinor === month.totals.payMinor &&
    recent[0].approvedMinutes === month.totals.approvedMinutes &&
    recent[0].approvedShifts === month.totals.approvedShifts,
);
r = await call(token.a, "GET", "/api/pay");
check("recent months are the same in the current month's answer", JSON.stringify(r.json.recentMonths) === JSON.stringify(recent));

for (const bad of ["2026-13", "abc", "2026-1"]) {
  r = await call(token.a, "GET", `/api/pay?month=${bad}`);
  check(`month=${bad} → 400`, r.status === 400 && r.json.error === "invalid", r.status);
}

// Other roles and firms.
r = await call(null, "GET", "/api/pay");
check("signed out → 401", r.status === 401, r.status);
r = await call(token.dispatcher, "GET", "/api/pay");
check("dispatcher → 403 role", r.status === 403 && r.json.error === "role", r.status);
r = await call(token.owner, "GET", "/api/pay");
check("owner → 403 role", r.status === 403 && r.json.error === "role", r.status);

const ivanovIds = new Set((await sql`select id from shifts where firm_id = ${ivanov}`).map((row) => row.id));
let firmBClean = true;
for (const m of [current, lastMonth]) {
  r = await call(token.b, "GET", `/api/pay?month=${m}`);
  firmBClean &&= r.status === 200 && r.json.days.every((d) => !ivanovIds.has(d.shiftId));
}
check("firm B courier sees no Ivanov shifts", firmBClean);

finish("pay");
