// People checks against a running dev server (prompts/21): only owners manage members, owners themselves can't be
// changed, nothing crosses firms, a dispatcher's depots drive their approvals scope, and removing someone keeps
// their shifts. Invites `people.check.<run>+clerk_test@example.com` (no email is sent) and revokes it; puts
// courier.c back in Ivanov Transport and restores the dispatcher's depots at the end.
// Run with `npm run check:people` (after db:seed).
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const { CLERK_SECRET_KEY } = process.env;

/** Clerk Backend API for what the app's routes deliberately can't do (re-adding a member). */
async function clerkApi(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
const token = {
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

const run = Date.now().toString(36);
const email = `people.check.${run}+clerk_test@example.com`;
const invitationIds = [];
let originalDepots = null;
let courierCRemoved = false;

try {
  // Only owners: every route answers `role` to couriers and dispatchers, and Firm B's courier too.
  for (const [who, t] of [
    ["courier", token.a],
    ["dispatcher", token.dispatcher],
    ["Firm B courier", token.b],
  ]) {
    const results = await Promise.all([
      call(t, "GET", "/api/people"),
      call(t, "POST", "/api/people/invitations", { email, role: "courier" }),
      call(t, "DELETE", "/api/people/invitations/orginv_abc"),
      call(t, "PATCH", `/api/people/${users.c}`, { role: "dispatcher" }),
      call(t, "DELETE", `/api/people/${users.c}`),
    ]);
    check(`${who} gets role on every People route`, results.every((r) => r.status === 403 && r.json?.error === "role"),
      results.map((r) => r.status).join(","));
  }
  let r = await call(null, "GET", "/api/people");
  check("signed out gets unauthorized", r.status === 401, r.status);

  // Owner: the list.
  r = await call(token.owner, "GET", "/api/people");
  const list = r.json;
  check("owner lists the firm's people", r.status === 200 && Array.isArray(list?.members), r.status);
  const byId = new Map(list.members.map((m) => [m.userId, m]));
  check("owner, dispatcher and couriers a + c are members",
    byId.get(users.owner)?.role === "owner" && byId.get(users.dispatcher)?.role === "dispatcher" &&
      byId.get(users.a)?.role === "courier" && byId.get(users.c)?.role === "courier");
  check("no Firm B user in Ivanov's list", !byId.has(users.b));
  check("members carry an email", list.members.every((m) => typeof m.email === "string" && m.email.includes("@")));
  originalDepots = byId.get(users.dispatcher).depotIds;
  check("the seeded dispatcher has depots", originalDepots.length > 0, JSON.stringify(originalDepots));
  check("only dispatchers carry depots", list.members.every((m) => m.role === "dispatcher" || m.depotIds.length === 0));
  check("depots are the active ones", list.depots.length > 0 && list.depots.every((d) => d.id && d.name));

  // Invitations.
  r = await call(token.owner, "POST", "/api/people/invitations", { email: `  ${email.toUpperCase()} `, role: "courier" });
  check("owner invites a courier (email normalised)", r.status === 201 && r.json?.email === email && r.json?.role === "courier",
    `${r.status} ${JSON.stringify(r.json)}`);
  if (r.json?.id) invitationIds.push(r.json.id);
  const invitationId = r.json?.id;
  r = await call(token.owner, "POST", "/api/people/invitations", { email, role: "dispatcher" });
  check("inviting a pending email again is exists", r.status === 409 && r.json?.error === "exists", r.status);
  r = await call(token.owner, "POST", "/api/people/invitations", { email: "courier.a+clerk_test@example.com", role: "courier" });
  check("inviting a member is exists", r.status === 409 && r.json?.error === "exists", r.status);
  r = await call(token.owner, "POST", "/api/people/invitations", { email: `mechanic.${email}`, role: "mechanic" });
  check("owner invites a mechanic", r.status === 201 && r.json?.role === "mechanic", r.status);
  if (r.json?.id) invitationIds.push(r.json.id);
  r = await call(token.owner, "GET", "/api/people");
  check("the mechanic invitation is listed", r.json?.invitations.some((i) => i.role === "mechanic" && i.email === `mechanic.${email}`));
  check("the seeded mechanic is a member", r.json?.members.some((m) => m.role === "mechanic" && m.depotIds.length === 0));
  r = await call(token.owner, "POST", "/api/people/invitations", { email: `owner.${email}`, role: "owner" });
  check("inviting an owner is invalid", r.status === 400 && r.json?.error === "invalid", r.status);
  r = await call(token.owner, "POST", "/api/people/invitations", { email: "not-an-email", role: "courier" });
  check("a bad email is invalid", r.status === 400 && r.json?.error === "invalid", r.status);
  r = await call(token.owner, "GET", "/api/people");
  check("the pending invitation is listed", r.json?.invitations.some((i) => i.id === invitationId && i.email === email));
  r = await call(token.owner, "DELETE", `/api/people/invitations/${invitationId}`);
  check("owner revokes it", r.status === 200 && !r.json?.invitations.some((i) => i.id === invitationId), r.status);
  r = await call(token.owner, "DELETE", `/api/people/invitations/${invitationId}`);
  check("revoking again is notFound", r.status === 404 && r.json?.error === "notFound", r.status);

  // An invitation of Firm B can't be revoked by Ivanov's owner.
  const otherInvite = await clerkApi("POST", `/organizations/${firmB}/invitations`, {
    email_address: `people.b.${run}+clerk_test@example.com`,
    role: "org:member",
    public_metadata: { role: "courier" },
  });
  if (otherInvite.json?.id) {
    r = await call(token.owner, "DELETE", `/api/people/invitations/${otherInvite.json.id}`);
    check("a Firm B invitation is notFound", r.status === 404, r.status);
    await clerkApi("POST", `/organizations/${firmB}/invitations/${otherInvite.json.id}/revoke`, {});
  } else check("created a Firm B invitation to test with", false, otherInvite.status);

  // Owners can't be changed, and nobody outside the firm.
  for (const [label, path, method, body] of [
    ["own role", `/api/people/${users.owner}`, "PATCH", { role: "courier" }],
    ["own removal", `/api/people/${users.owner}`, "DELETE"],
  ]) {
    r = await call(token.owner, method, path, body);
    check(`${label} is notEditable`, r.status === 409 && r.json?.error === "notEditable", r.status);
  }
  r = await call(token.owner, "PATCH", `/api/people/${users.b}`, { role: "dispatcher" });
  check("a Firm B user is notFound", r.status === 404, r.status);
  r = await call(token.owner, "DELETE", `/api/people/${users.b}`);
  check("removing a Firm B user is notFound", r.status === 404, r.status);
  r = await call(token.owner, "PATCH", "/api/people/not-a-user", { role: "dispatcher" });
  check("a malformed user ID is notFound", r.status === 404, r.status);

  // Dispatcher depots.
  const depotRows = await sql`select id, firm_id, archived_at from depots`;
  const firmBDepot = depotRows.find((d) => d.firm_id === firmB);
  const archived = depotRows.find((d) => d.firm_id === ivanov && d.archived_at);
  if (firmBDepot) {
    r = await call(token.owner, "PATCH", `/api/people/${users.dispatcher}`, { depotIds: [firmBDepot.id] });
    check("a Firm B depot is invalid", r.status === 400 && r.json?.error === "invalid", r.status);
  }
  if (archived) {
    r = await call(token.owner, "PATCH", `/api/people/${users.dispatcher}`, { depotIds: [archived.id] });
    check("an archived depot is invalid", r.status === 400 && r.json?.error === "invalid", r.status);
  }
  r = await call(token.owner, "PATCH", `/api/people/${users.a}`, { depotIds: [] });
  check("depots for a courier are invalid", r.status === 400 && r.json?.error === "invalid", r.status);
  const one = list.depots.find((d) => !originalDepots.includes(d.id)) ?? list.depots[0];
  r = await call(token.owner, "PATCH", `/api/people/${users.dispatcher}`, { depotIds: [one.id] });
  check("owner sets the dispatcher's depots", r.status === 200 && JSON.stringify(r.json?.depotIds) === JSON.stringify([one.id]),
    `${r.status} ${JSON.stringify(r.json)}`);
  const dispatcherToken = await tokenFor(users.dispatcher, ivanov);
  const [pending, reviewed] = await Promise.all([
    call(dispatcherToken, "GET", "/api/approvals?view=pending"),
    call(dispatcherToken, "GET", "/api/approvals?view=reviewed"),
  ]);
  const seen = [...(pending.json?.items ?? []), ...(reviewed.json?.items ?? [])];
  check("the dispatcher's approvals follow the new depots", seen.every((i) => i.shift.depot.id === one.id),
    [...new Set(seen.map((i) => i.shift.depot.name))].join(","));
  r = await call(token.owner, "PATCH", `/api/people/${users.dispatcher}`, { depotIds: originalDepots });
  check("owner restores the dispatcher's depots", r.status === 200 && r.json.depotIds.length === originalDepots.length, r.status);
  originalDepots = null;

  // Role round trip on courier.c: shifts stay, depots start empty.
  const [{ n: shiftsBefore }] = await sql`select count(*)::int as n from shifts where firm_id = ${ivanov} and user_id = ${users.c}`;
  r = await call(token.owner, "PATCH", `/api/people/${users.c}`, { role: "dispatcher" });
  check("owner makes courier.c a dispatcher", r.status === 200 && r.json?.role === "dispatcher" && r.json.depotIds.length === 0,
    r.status);
  r = await call(token.owner, "PATCH", `/api/people/${users.c}`, { role: "mechanic" });
  check("owner makes courier.c a mechanic", r.status === 200 && r.json?.role === "mechanic" && r.json.depotIds.length === 0, r.status);
  r = await call(token.owner, "PATCH", `/api/people/${users.c}`, { role: "courier" });
  check("and back to courier", r.status === 200 && r.json?.role === "courier", r.status);
  const [{ n: depotRowsC }] = await sql`select count(*)::int as n from dispatcher_depots where user_id = ${users.c}`;
  check("no depot rows left for courier.c", depotRowsC === 0, depotRowsC);

  // Remove courier.c: membership gone, history kept, Team shows them as former.
  r = await call(token.owner, "DELETE", `/api/people/${users.c}`);
  courierCRemoved = r.status === 200;
  check("owner removes courier.c", r.status === 200, r.status);
  check("courier.c is no longer listed", !r.json?.members.some((m) => m.userId === users.c));
  const [{ n: shiftsAfter }] = await sql`select count(*)::int as n from shifts where firm_id = ${ivanov} and user_id = ${users.c}`;
  check("courier.c's shifts are kept", shiftsAfter === shiftsBefore && shiftsAfter > 0, `${shiftsBefore} → ${shiftsAfter}`);
  r = await call(token.owner, "GET", "/api/team");
  const teamC = r.json?.couriers.find((m) => m.userId === users.c);
  check("Team shows courier.c as former", teamC?.former === true, JSON.stringify(teamC));
  check("Team shows courier.a as current", r.json?.couriers.find((m) => m.userId === users.a)?.former === false);
  r = await call(token.owner, "GET", "/api/couriers");
  check("Couriers marks only non-members as former",
    (r.json?.couriers ?? []).every((m) => m.former === (m.userId === users.c)), r.status);
  let removedStatus;
  try {
    const stale = await tokenFor(users.c, ivanov);
    removedStatus = (await call(stale, "GET", "/api/home")).status;
  } catch {
    removedStatus = "no token";
  }
  check("courier.c can't use the firm any more", removedStatus === "no token" || removedStatus === 403, removedStatus);
  r = await call(token.owner, "DELETE", `/api/people/${users.c}`);
  check("removing again is notFound", r.status === 404, r.status);
} finally {
  if (courierCRemoved) {
    const back = await clerkApi("POST", `/organizations/${ivanov}/memberships`, { user_id: users.c, role: "org:member" });
    check("courier.c is put back in Ivanov Transport", back.status === 200, back.status);
    // No metadata: the next request claims courier, as before the removal.
    const me = await call(await tokenFor(users.c, ivanov), "GET", "/api/me");
    check("courier.c is a courier again", me.json?.role === "courier", JSON.stringify(me.json));
  }
  if (originalDepots) await call(await tokenFor(users.owner, ivanov), "PATCH", `/api/people/${users.dispatcher}`, { depotIds: originalDepots });
  for (const id of invitationIds) await clerkApi("POST", `/organizations/${ivanov}/invitations/${id}/revoke`, {});
}

finish("people");
