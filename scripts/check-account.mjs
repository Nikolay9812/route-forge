// Account deletion checks against a running dev server (prompts/26): a throwaway `+clerk_test` courier joins Ivanov
// Transport, starts a shift, saves contacts and an ID card photo, then deletes their account. Their documents, photo
// file and Clerk user are gone; the shift stays. Owners are refused, and a request without a session is
// unauthorized. Run with `npm run check:account` (after db:seed; dev branch only).
import { headObject } from "../src/server/storage.ts";
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const { CLERK_SECRET_KEY } = process.env;

async function clerkApi(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const ivanov = await orgByName("Ivanov Transport");
const owner = await userByEmail("owner+clerk_test@example.com");

const run = Date.now().toString(36);
const created = await clerkApi("POST", "/users", {
  email_address: [`account.check.${run}+clerk_test@example.com`],
  first_name: "Account",
  last_name: "Check",
  skip_password_requirement: true,
});
if (created.status !== 200) throw new Error(`Creating the test user failed: ${created.status}`);
const userId = created.json.id;
let deleted = false;

try {
  const joined = await clerkApi("POST", `/organizations/${ivanov}/memberships`, { user_id: userId, role: "org:courier" });
  if (joined.status !== 200) throw new Error(`Adding the test user to Ivanov Transport failed: ${joined.status}`);
  const token = await tokenFor(userId, ivanov);

  // A shift, contacts and an ID card photo.
  let r = await call(token, "GET", "/api/shifts/today");
  const [depot] = r.json.stations;
  const [bus] = r.json.buses;
  r = await call(token, "POST", "/api/shifts/today", { depotId: depot.id, carId: bus.id, startKm: 1000, loaded: 100 });
  check("the test courier starts a shift", r.status === 201, r.status);
  const shiftId = r.json?.id;
  r = await call(token, "PATCH", "/api/details", {
    section: "contacts",
    values: { phone: "+49 160 0000000", emergencyName: "Check Contact", emergencyPhone: "+49 30 000000" },
  });
  check("the test courier saves contacts", r.status === 200, r.status);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
  const front = { section: "idCard", slot: "front" };
  r = await call(token, "POST", "/api/details/photos", { ...front, contentType: "image/jpeg" });
  await fetch(r.json.uploadUrl, { method: "PUT", body: jpeg, headers: { "Content-Type": "image/jpeg" } });
  const key = r.json.key;
  r = await call(token, "PUT", "/api/details/photos", { ...front, key });
  check("the test courier keeps an ID card photo", r.status === 200 && (await headObject(key)) !== null, r.status);

  // Who can't delete.
  r = await call(null, "DELETE", "/api/me");
  check("no session → unauthorized", r.status === 401, r.status);
  r = await call(await tokenFor(owner, ivanov), "DELETE", "/api/me");
  check("an owner → notEditable", r.status === 409 && r.json?.error === "notEditable", r.status);

  // The courier deletes their account.
  r = await call(token, "DELETE", "/api/me");
  deleted = r.status === 200;
  check("the courier deletes their account", deleted, r.status);
  const [details] = await sql`select count(*)::int as n from courier_details where user_id = ${userId}`;
  const [photos] = await sql`select count(*)::int as n from document_photos where user_id = ${userId}`;
  check("their documents are deleted", details.n === 0 && photos.n === 0, `${details.n} rows, ${photos.n} photos`);
  check("their photo file is deleted", (await headObject(key)) === null);
  check("their Clerk user is deleted", (await clerkApi("GET", `/users/${userId}`)).status === 404);
  const [shift] = await sql`select count(*)::int as n from shifts where id = ${shiftId} and user_id = ${userId}`;
  check("their shift stays", shift.n === 1);
} finally {
  await sql`delete from shift_photos where shift_id in (select id from shifts where user_id = ${userId})`;
  await sql`delete from shifts where user_id = ${userId}`;
  if (!deleted) await clerkApi("DELETE", `/users/${userId}`);
}

finish("account");
