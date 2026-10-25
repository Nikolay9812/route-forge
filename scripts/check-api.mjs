// API permission and validation checks against a running dev server (`npx expo start`), as each role and as a
// courier of a second firm. Mints short-lived session tokens for the `+clerk_test` users through the Clerk Backend
// API, and clears those users' shifts for today first (dev branch only). Salary amounts are never printed.
// Run with `npm run check:api` (API_BASE overrides http://localhost:8081).
import { neon } from "@neondatabase/serverless";

const { CLERK_SECRET_KEY, DATABASE_URL, NEON_BRANCH, API_BASE = "http://localhost:8081" } = process.env;
if (!CLERK_SECRET_KEY || !DATABASE_URL) throw new Error("CLERK_SECRET_KEY and DATABASE_URL must be set (.env.local).");
if (NEON_BRANCH !== "dev") throw new Error("check-api deletes test shifts: run it only against the Neon dev branch.");

async function clerk(path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Clerk ${path}: ${res.status}`);
  return res.json();
}

async function userByEmail(email) {
  const [user] = await clerk(`/users?email_address=${encodeURIComponent(email)}`);
  if (!user) throw new Error(`No Clerk user ${email}. Create the test users first.`);
  return user.id;
}

async function orgByName(name) {
  const { data } = await clerk(`/organizations?query=${encodeURIComponent(name)}`);
  const org = data.find((o) => o.name === name);
  if (!org) throw new Error(`No Clerk organization "${name}".`);
  return org.id;
}

/** A fresh session token for the user with the firm active. */
async function tokenFor(userId, orgId) {
  const session = await clerk("/sessions", { user_id: userId });
  const { jwt } = await clerk(`/sessions/${session.id}/tokens`, { organization_id: orgId });
  return jwt;
}

async function call(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
}

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
};

// Start clean: today's shifts for the test couriers (any date >= yesterday covers timezone edges).
const sql = neon(DATABASE_URL);
await sql`delete from shifts where user_id = any(${[users.a, users.c, users.b]}) and date >= current_date - 1`;

const tokens = {
  a: await tokenFor(users.a, ivanov),
  c: await tokenFor(users.c, ivanov),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  b: await tokenFor(users.b, firmB),
};

// Session and role.
let r = await call(null, "GET", "/api/shifts/today");
check("no token → 401", r.status === 401, r.status);
r = await call("not-a-token", "GET", "/api/shifts/today");
check("bad token → 401", r.status === 401, r.status);
r = await call(tokens.dispatcher, "GET", "/api/shifts/today");
check("dispatcher → 403 role", r.status === 403 && r.json?.error === "role", `${r.status} ${r.json?.error}`);
r = await call(tokens.dispatcher, "GET", "/api/home");
check("dispatcher home → 403 role", r.status === 403, r.status);

// Firm B sees only its own stations and buses, and can't use Ivanov's.
const todayA = await call(tokens.a, "GET", "/api/shifts/today");
const todayB = await call(tokens.b, "GET", "/api/shifts/today");
check("courier A loads today", todayA.status === 200 && todayA.json.shift === null, todayA.status);
check(
  "firm B sees only TFB1 / B TF 100",
  todayB.json?.stations.map((s) => s.name).join() === "TFB1" && todayB.json?.buses.map((b) => b.plate).join() === "B TF 100",
);
check("firm B name comes from Clerk", todayB.json?.firm.name === "Test Firm B");
const [hbw3] = todayA.json.stations.filter((s) => s.name === "HBW3");
const [bus] = todayA.json.buses.filter((b) => b.plate === "KH I 6004");
const tfb1 = todayB.json.stations[0];
r = await call(tokens.b, "POST", "/api/shifts/today", { depotId: hbw3.id, carId: bus.id, startKm: 1, loaded: 1 });
check("firm B can't start with Ivanov's depot → 400", r.status === 400, r.status);

// Start.
r = await call(tokens.a, "POST", "/api/shifts/today", { depotId: hbw3.id, carId: bus.id, startKm: 48213, loaded: 140 });
check("A starts → 201", r.status === 201 && r.json.status === "draft", r.status);
r = await call(tokens.a, "POST", "/api/shifts/today", { depotId: hbw3.id, carId: bus.id, startKm: 48213, loaded: 140 });
check("A starts twice → 409 exists", r.status === 409 && r.json?.error === "exists", r.status);
r = await call(tokens.a, "POST", "/api/shifts/today", { depotId: hbw3.id, carId: bus.id, startKm: -5, loaded: 140 });
check("negative km → 400", r.status === 400, r.status);

// Edits.
r = await call(tokens.a, "PATCH", "/api/shifts/today", { endKm: 48000 });
check("end km below start is saved while draft", r.status === 200 && r.json.endKm === 48000, r.status);
r = await call(tokens.a, "POST", "/api/shifts/today/submit");
check("submit with end < start → 409 endBelowStart", r.status === 409 && r.json?.error === "endBelowStart", r.json?.error);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { returned: 141 });
check("returned > loaded → 400", r.status === 400, r.status);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { startedAt: new Date(Date.now() + 3_600_000).toISOString() });
check("start time in the future → 400", r.status === 400, r.status);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { startedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() });
check("start time on another day → 400", r.status === 400, r.status);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { firmId: ivanov });
check("unknown field (firmId) → 400", r.status === 400, r.status);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { depotId: tfb1.id });
check("another firm's depot → 400", r.status === 400, r.status);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { endKm: 48300, returned: 10, pickups: 3 });
check("valid edit → 200", r.status === 200 && r.json.endKm === 48300 && r.json.returned === 10, r.status);

// Courier C (same firm) never sees A's shift.
r = await call(tokens.c, "GET", "/api/shifts/today");
check("courier C doesn't see A's shift", r.status === 200 && r.json.shift === null);
r = await call(tokens.c, "GET", "/api/home");
const recentIds = new Set(todayA.json.recent.map((s) => s.id));
check("courier C's home has none of A's shifts", r.status === 200 && r.json.recent.every((s) => !recentIds.has(s.id)));
r = await call(tokens.c, "PATCH", "/api/shifts/today", { endKm: 1 });
check("courier C can't edit (has no shift) → 404", r.status === 404, r.status);

// Submit, then locked.
r = await call(tokens.a, "POST", "/api/shifts/today/submit");
check(
  "A submits → submitted with minutes",
  r.status === 200 && r.json.status === "submitted" && Number.isInteger(r.json.minutes) && r.json.finishedAt,
  r.status,
);
r = await call(tokens.a, "PATCH", "/api/shifts/today", { endKm: 48400 });
check("edit after submit → 409 notEditable", r.status === 409 && r.json?.error === "notEditable", r.status);
r = await call(tokens.a, "POST", "/api/shifts/today/submit");
check("submit twice → 409", r.status === 409, r.status);

// Home.
r = await call(tokens.a, "GET", "/api/home");
check("A's home shows today submitted", r.status === 200 && r.json.today?.status === "submitted");
check("A's home totals are numbers", Number.isInteger(r.json?.totals.payMinor) && Number.isInteger(r.json?.totals.approvedMinutes));
r = await call(tokens.b, "GET", "/api/home");
check("firm B home only has TFB1 shifts", r.status === 200 && r.json.recent.every((s) => s.depot.name === "TFB1"));

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll API checks passed.");
process.exitCode = failures ? 1 : 0;
