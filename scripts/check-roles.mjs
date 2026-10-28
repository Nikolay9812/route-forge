// Role checks against a running dev server (prompts/27): the app role comes from `firm_members`, never Clerk's role;
// a member removed in Clerk loses access even with their row still there; an invitation's role and a firm's creator
// reach the table on first sight; and no firm sees another's roles. Uses throwaway `roles.*.<run>+clerk_test` users
// and a throwaway firm, and puts courier.a, courier.c and courier.b back as they were.
// Run with `npm run check:roles` (after db:seed; dev branch only; leave courier.c alone while it runs).
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const { CLERK_SECRET_KEY } = process.env;

/** Clerk Backend API for what the app deliberately can't do (Clerk roles, memberships, metadata). */
async function clerkApi(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** A token for the user with the firm active, or null when Clerk won't issue one (not a member). */
async function tokenOrNull(userId, orgId) {
  try {
    return await tokenFor(userId, orgId);
  } catch {
    return null;
  }
}

async function roleRow(firmId, userId) {
  const [row] = await sql`select role from firm_members where firm_id = ${firmId} and user_id = ${userId}`;
  return row?.role ?? null;
}

async function newUser(name) {
  const r = await clerkApi("POST", "/users", {
    email_address: [`roles.${name}.${run}+clerk_test@example.com`],
    first_name: "Roles",
    last_name: "Check",
    skip_password_requirement: true,
  });
  if (r.status !== 200) throw new Error(`Creating a test user failed: ${r.status}`);
  tempUsers.push(r.json.id);
  return r.json.id;
}

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
const run = Date.now().toString(36);
const tempUsers = [];
const tempOrgs = [];
const invitationIds = [];
let courierCRemoved = false;

try {
  // 1. The table decides, whatever Clerk's role says.
  await clerkApi("PATCH", `/organizations/${ivanov}/memberships/${users.a}`, { role: "org:admin" });
  let token = await tokenFor(users.a, ivanov);
  let r = await call(token, "GET", "/api/me");
  check("courier.a as Clerk org:admin is still a courier", r.status === 200 && r.json?.role === "courier", JSON.stringify(r.json));
  r = await call(token, "GET", "/api/people");
  check("… and can't reach People", r.status === 403 && r.json?.error === "role", r.status);
  await clerkApi("PATCH", `/organizations/${ivanov}/memberships/${users.a}`, { role: "org:member" });

  await sql`update firm_members set role = 'dispatcher' where firm_id = ${ivanov} and user_id = ${users.c}`;
  token = await tokenFor(users.c, ivanov);
  r = await call(token, "GET", "/api/me");
  check("courier.c made dispatcher in the table is a dispatcher", r.json?.role === "dispatcher", JSON.stringify(r.json));
  r = await call(token, "GET", "/api/approvals?view=pending");
  check("… reaches Approvals", r.status === 200, r.status);
  r = await call(token, "GET", "/api/shifts/today");
  check("… and no longer the courier shift", r.status === 403 && r.json?.error === "role", r.status);
  await sql`update firm_members set role = 'courier' where firm_id = ${ivanov} and user_id = ${users.c}`;
  r = await call(await tokenFor(users.c, ivanov), "GET", "/api/shifts/today");
  check("back as courier, courier.c gets the shift again", r.status === 200, r.status);

  // 2. Removed in Clerk (as in the dashboard): the row stays a while, but gives nothing.
  const [{ n: shiftsBefore }] = await sql`select count(*)::int as n from shifts where firm_id = ${ivanov} and user_id = ${users.c}`;
  r = await clerkApi("DELETE", `/organizations/${ivanov}/memberships/${users.c}`);
  courierCRemoved = r.status === 200;
  check("courier.c is removed in Clerk", courierCRemoved, r.status);
  check("… their role row is still there", (await roleRow(ivanov, users.c)) === "courier");
  token = await tokenOrNull(users.c, ivanov);
  const removed = token ? (await call(token, "GET", "/api/shifts/today")).status : "no token";
  check("… and they can't use the firm", removed === "no token" || removed === 403, removed);
  r = await call(await tokenFor(users.owner, ivanov), "GET", "/api/people");
  check("the owner's People list leaves them out", r.status === 200 && !r.json.members.some((m) => m.userId === users.c));
  check("… and drops their role row", (await roleRow(ivanov, users.c)) === null);
  r = await clerkApi("POST", `/organizations/${ivanov}/memberships`, { user_id: users.c, role: "org:member" });
  courierCRemoved = r.status !== 200;
  r = await call(await tokenFor(users.c, ivanov), "GET", "/api/me");
  check("re-added, courier.c claims courier", r.json?.role === "courier", JSON.stringify(r.json));
  const [{ n: shiftsAfter }] = await sql`select count(*)::int as n from shifts where firm_id = ${ivanov} and user_id = ${users.c}`;
  check("… with their shifts kept", shiftsAfter === shiftsBefore && shiftsAfter > 0, `${shiftsBefore} → ${shiftsAfter}`);

  // 3. An invitation's role reaches the table: accepting leaves it in the membership's publicMetadata.
  const invited = await newUser("invited");
  await clerkApi("POST", `/organizations/${ivanov}/memberships`, { user_id: invited, role: "org:member" });
  await clerkApi("PATCH", `/organizations/${ivanov}/memberships/${invited}/metadata`, { public_metadata: { role: "mechanic" } });
  check("no role row before their first request", (await roleRow(ivanov, invited)) === null);
  token = await tokenFor(invited, ivanov);
  r = await call(token, "GET", "/api/me");
  check("the invited member claims mechanic", r.json?.role === "mechanic" && r.json?.firmId === ivanov, JSON.stringify(r.json));
  check("… stored in firm_members", (await roleRow(ivanov, invited)) === "mechanic");
  r = await call(token, "GET", "/api/garage");
  check("… and reaches the garage", r.status === 200, r.status);
  r = await clerkApi("POST", `/organizations/${ivanov}/invitations`, {
    email_address: `roles.dashboard.${run}+clerk_test@example.com`,
    role: "org:member",
  });
  if (r.json?.id) invitationIds.push(r.json.id);
  r = await call(await tokenFor(users.owner, ivanov), "GET", "/api/people");
  const dashboardInvite = r.json?.invitations.find((i) => i.email === `roles.dashboard.${run}+clerk_test@example.com`);
  check("an invitation without a role shows as courier", dashboardInvite?.role === "courier", JSON.stringify(dashboardInvite));

  // 4. A firm's creator (Clerk's creator role org:admin) is its owner.
  const creator = await newUser("creator");
  r = await clerkApi("POST", "/organizations", { name: `Roles Check ${run}`, created_by: creator });
  const firmC = r.json?.id;
  if (firmC) tempOrgs.push(firmC);
  check("a throwaway firm is created", Boolean(firmC), r.status);
  r = await call(await tokenFor(creator, firmC), "GET", "/api/me");
  check("its creator is the owner", r.json?.role === "owner" && r.json?.firmId === firmC, JSON.stringify(r.json));

  // 5. No firm sees another's roles. A stray row for courier.b in Ivanov (no membership) gives nothing.
  await sql`insert into firm_members (firm_id, user_id, role, set_by) values (${ivanov}, ${users.b}, 'owner', 'check')`;
  r = await call(await tokenFor(users.b, firmB), "GET", "/api/me");
  check("courier.b is a Firm B courier", r.json?.role === "courier" && r.json?.firmId === firmB, JSON.stringify(r.json));
  r = await call(await tokenFor(users.b, firmB), "GET", "/api/people");
  check("… who can't list anyone's roles", r.status === 403 && r.json?.error === "role", r.status);
  token = await tokenOrNull(users.b, ivanov);
  const stray = token ? (await call(token, "GET", "/api/people")).status : "no token";
  check("… and gets nothing in Ivanov from a stray owner row", stray === "no token" || stray === 403, stray);
  r = await call(await tokenFor(users.owner, ivanov), "PATCH", `/api/people/${users.b}`, { role: "dispatcher" });
  check("Ivanov's owner can't change courier.b", r.status === 404, r.status);
  r = await call(await tokenFor(users.owner, ivanov), "GET", "/api/people");
  check("Ivanov's People list never shows courier.b", r.status === 200 && !r.json.members.some((m) => m.userId === users.b));
  check("… and drops the stray row", (await roleRow(ivanov, users.b)) === null);
  // People needs the firm set up (otherwise firmNotSetUp).
  await sql`insert into firm_settings (firm_id, currency, time_zone) values (${firmC}, 'EUR', 'Europe/Berlin')`;
  r = await call(await tokenFor(creator, firmC), "GET", "/api/people");
  check("the throwaway firm's owner sees only their own firm",
    r.status === 200 && r.json.members.length === 1 && r.json.members[0].userId === creator, JSON.stringify(r.json?.members));
} finally {
  await clerkApi("PATCH", `/organizations/${ivanov}/memberships/${users.a}`, { role: "org:member" });
  if (courierCRemoved) await clerkApi("POST", `/organizations/${ivanov}/memberships`, { user_id: users.c, role: "org:member" });
  await sql`
    insert into firm_members (firm_id, user_id, role, set_by) values (${ivanov}, ${users.c}, 'courier', 'seed')
    on conflict (firm_id, user_id) do update set role = 'courier'`;
  await sql`delete from firm_members where firm_id = ${ivanov} and user_id = ${users.b}`;
  for (const id of invitationIds) await clerkApi("POST", `/organizations/${ivanov}/invitations/${id}/revoke`, {});
  for (const id of tempOrgs) {
    await clerkApi("DELETE", `/organizations/${id}`);
    await sql`delete from firm_members where firm_id = ${id}`;
    await sql`delete from firm_settings where firm_id = ${id}`;
  }
  for (const id of tempUsers) {
    await clerkApi("DELETE", `/users/${id}`);
    await sql`delete from firm_members where user_id = ${id}`;
  }
}

finish("roles");
