// Calendar and Team checks against a running dev server: couriers see only their own months, dispatchers only
// couriers and shifts in their depots, owners the whole firm, and no firm sees another. Read-only.
// Run with `npm run check:calendar` (after db:seed).
import { addMonths } from "../src/domain/calendar.ts";

import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
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

// Courier: own calendar.
let r = await call(token.a, "GET", "/api/calendar");
check("courier gets the current month", r.status === 200 && r.json.month === r.json.today.slice(0, 7), r.status);
const current = r.json.month;
const lastMonth = addMonths(current, -1);
check("courier pages back to the seeded start", r.json.firstMonth === addMonths(current, -6), r.json.firstMonth);

r = await call(token.a, "GET", `/api/calendar?month=${lastMonth}`);
const ownIds = new Set(
  (await sql`select id from shifts where user_id = ${users.a} and firm_id = ${ivanov}`).map((row) => row.id),
);
check("courier's month has only their own shifts", r.json.shifts.length > 0 && r.json.shifts.every((s) => ownIds.has(s.id)));
check("courier's month is that month only", r.json.shifts.every((s) => s.date.startsWith(lastMonth)));
check("shifts are oldest first", r.json.shifts.every((s, i, all) => i === 0 || all[i - 1].date < s.date));

// Stats against a count straight from the database.
const [hand] = await sql`
  select count(*)::int as shifts,
    coalesce(sum(minutes - case when minutes > 540 then 45 when minutes > 360 then 30 else 0 end) filter (where status in ('submitted', 'approved')), 0)::int as minutes,
    coalesce(sum(minutes - case when minutes > 540 then 45 when minutes > 360 then 30 else 0 end) filter (where status = 'approved'), 0)::int as approved,
    (count(*) filter (where status = 'submitted'))::int as submitted,
    (count(*) filter (where status = 'rejected'))::int as rejected
  from shifts where firm_id = ${ivanov} and user_id = ${users.a} and to_char(date, 'YYYY-MM') = ${lastMonth}`;
const stats = r.json.stats;
check(
  "stats match a hand count",
  stats.shifts === hand.shifts &&
    stats.minutes === hand.minutes &&
    stats.approvedMinutes === hand.approved &&
    stats.submitted === hand.submitted &&
    stats.rejected === hand.rejected,
  JSON.stringify({ stats, hand }),
);
check("last month has a rejected and a waiting shift", hand.rejected >= 1 && hand.submitted >= 1);

for (const month of ["2026-13", "abc", "2026-1"]) {
  r = await call(token.a, "GET", `/api/calendar?month=${month}`);
  check(`month=${month} → 400`, r.status === 400 && r.json.error === "invalid", r.status);
}
r = await call(null, "GET", "/api/calendar");
check("signed out → 401", r.status === 401, r.status);
r = await call(token.a, "GET", "/api/team");
check("courier → /api/team 403", r.status === 403 && r.json.error === "role", r.status);
r = await call(token.a, "GET", `/api/team/${users.c}`);
check("courier → another courier's calendar 403", r.status === 403, r.status);
r = await call(token.dispatcher, "GET", "/api/calendar");
check("dispatcher → courier calendar 403", r.status === 403 && r.json.error === "role", r.status);

// Firm B sees only firm B.
r = await call(token.b, "GET", `/api/calendar?month=${lastMonth}`);
const firmBIds = new Set((await sql`select id from shifts where firm_id = ${firmB}`).map((row) => row.id));
check("firm B courier sees only firm B shifts", r.json.shifts.length > 0 && r.json.shifts.every((s) => firmBIds.has(s.id)));

// Dispatcher: couriers with shifts in HBW3/HBW1 only.
r = await call(token.dispatcher, "GET", "/api/team");
const dispatcherTeam = new Set(r.json.couriers.map((m) => m.userId));
check("dispatcher's team has courier.a", dispatcherTeam.has(users.a));
check("dispatcher's team lacks courier.c (HBW7 only)", !dispatcherTeam.has(users.c));
check("dispatcher's team lacks firm B", !dispatcherTeam.has(users.b));
check("team rows carry no pay", r.json.couriers.every((m) => !("payMinor" in m)));

r = await call(token.dispatcher, "GET", `/api/team/${users.c}`);
check("dispatcher → courier.c 404", r.status === 404, r.status);
r = await call(token.dispatcher, "GET", `/api/team/${users.b}`);
check("dispatcher → firm B courier 404", r.status === 404, r.status);
let allInScope = true;
for (const month of [current, lastMonth, addMonths(current, -3)]) {
  r = await call(token.dispatcher, "GET", `/api/team/${users.a}?month=${month}`);
  allInScope &&= r.status === 200 && r.json.shifts.every((s) => ["HBW3", "HBW1"].includes(s.depot.name));
}
check("dispatcher sees courier.a's HBW3/HBW1 shifts only", allInScope);
check("dispatcher's courier calendar has a name", typeof r.json.courierName === "string" && r.json.courierName !== "");
r = await call(token.dispatcher, "GET", `/api/team/${users.a}?month=2026-00`);
check("reviewer month=2026-00 → 400", r.status === 400, r.status);

// Owner: the whole firm.
r = await call(token.owner, "GET", "/api/team");
const ownerTeam = new Set(r.json.couriers.map((m) => m.userId));
check("owner's team has courier.a and courier.c", ownerTeam.has(users.a) && ownerTeam.has(users.c));
check("owner's team lacks firm B", !ownerTeam.has(users.b));
check("owner's team lacks the dispatcher and owner", !ownerTeam.has(users.dispatcher) && !ownerTeam.has(users.owner));
r = await call(token.owner, "GET", `/api/team/${users.c}?month=${lastMonth}`);
check("owner sees courier.c's HBW7 month", r.status === 200 && r.json.shifts.some((s) => s.depot.name === "HBW7"));
r = await call(token.owner, "GET", `/api/team/${users.b}`);
check("owner → firm B courier 404", r.status === 404, r.status);
r = await call(token.owner, "GET", "/api/team/user_doesnotexist");
check("owner → unknown user 404", r.status === 404, r.status);

finish("calendar");
