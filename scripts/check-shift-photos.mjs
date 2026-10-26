// Shift (vehicle check) photo checks against a running dev server (prompts/18): a courier adds, replaces and removes
// photos of their own draft or rejected shift only; dispatchers see them in their depots, owners in the whole firm,
// and nobody reaches another courier's or firm's. Starts courier.a's shift for today and removes it, its photos
// and their files at the end. Run with `npm run check:shift-photos` (after db:seed; dev branch only).
import { deleteObject, headObject, listKeys } from "../src/server/storage.ts";
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  c: await userByEmail("courier.c+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
// Tokens last about a minute, so each block asks for fresh ones.
const tokens = async () => ({
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  c: await tokenFor(users.c, ivanov),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const upload = (url, type = "image/jpeg") => fetch(url, { method: "PUT", body: jpeg, headers: { "Content-Type": type } });

/** Today's (and yesterday's, for timezone edges) shifts of courier.a, with their photos and files. */
async function clearToday() {
  for (const row of await sql`select object_key from shift_photos where shift_id in (select id from shifts where user_id = ${users.a} and date >= current_date - 1)`) {
    await deleteObject(row.object_key);
  }
  await sql`delete from shift_photos where shift_id in (select id from shifts where user_id = ${users.a} and date >= current_date - 1)`;
  await sql`delete from shift_changes where shift_id in (select id from shifts where user_id = ${users.a} and date >= current_date - 1)`;
  await sql`delete from shifts where user_id = ${users.a} and date >= current_date - 1`;
}

await clearToday();

try {
  let t = await tokens();

  // Start today's shift at HBW3 (one of the dispatcher's depots).
  let r = await call(t.a, "GET", "/api/shifts/today");
  check("today starts empty with no photos", r.status === 200 && r.json.shift === null && Object.keys(r.json.photos).length === 0, r.status);
  const station = r.json.stations.find((s) => s.name === "HBW3");
  const bus = r.json.buses[0];
  r = await call(t.a, "POST", "/api/shifts/today", { depotId: station.id, carId: bus.id, startKm: 1000, loaded: 100 });
  check("courier.a starts a shift", r.status === 201 && r.json.photoCount === 0, r.status);
  const id = r.json.id;
  const path = `/api/shifts/${id}/photos`;

  // Courier: start, upload, keep, show.
  r = await call(t.a, "POST", path, { slot: "front", contentType: "image/jpeg" });
  check("courier starts an upload", r.status === 200 && typeof r.json?.uploadUrl === "string", r.status);
  check("the key is under this shift and slot", r.json?.key.startsWith(`firms/${ivanov}/couriers/${users.a}/shifts/${id}/front/`));
  const first = r.json.key;
  check("the file goes straight to R2", (await upload(r.json.uploadUrl)).status === 200);
  r = await call(t.a, "PUT", path, { slot: "front", key: first });
  check("courier keeps the photo", r.status === 200 && r.json?.front?.key === first, r.status);
  const shown = await fetch(r.json.front.url);
  const bytes = new Uint8Array(await shown.arrayBuffer());
  check("the signed URL shows the same bytes", shown.ok && bytes.length === jpeg.length && bytes[0] === 0xff);
  r = await call(t.a, "GET", "/api/shifts/today");
  check("today lists the photo and counts it", r.json?.photos?.front?.key === first && r.json?.shift?.photoCount === 1);
  const [row] = await sql`select uploaded_by, user_id, size from shift_photos where shift_id = ${id} and slot = 'front'`;
  check("the row records the courier and the size", row?.uploaded_by === users.a && row?.user_id === users.a && row?.size === jpeg.length);

  // Replace, extras, remove.
  r = await call(t.a, "POST", path, { slot: "front", contentType: "image/png" });
  await upload(r.json.uploadUrl, "image/png");
  const second = r.json.key;
  r = await call(t.a, "PUT", path, { slot: "front", key: second });
  check("a new photo replaces the old one", r.json?.front?.key === second);
  check("the replaced file is deleted", (await headObject(first)) === null);
  r = await call(t.a, "POST", path, { slot: "extra1", contentType: "image/jpeg" });
  await upload(r.json.uploadUrl);
  await call(t.a, "PUT", path, { slot: "extra1", key: r.json.key });
  r = await call(t.a, "GET", "/api/shifts/today");
  check("an extra photo is listed but not counted", Boolean(r.json?.photos?.extra1) && r.json?.shift?.photoCount === 1);
  r = await call(t.a, "POST", path, { slot: "diesel", contentType: "image/jpeg" });
  await upload(r.json.uploadUrl);
  const diesel = r.json.key;
  await call(t.a, "PUT", path, { slot: "diesel", key: diesel });
  r = await call(t.a, "DELETE", `${path}?slot=diesel`);
  check("courier removes a photo", r.status === 200 && !r.json?.diesel && Boolean(r.json?.front), r.status);
  check("the removed file is deleted", (await headObject(diesel)) === null);
  r = await call(t.a, "DELETE", `${path}?slot=diesel`);
  check("removing an empty slot is fine", r.status === 200, r.status);

  // Bad input.
  r = await call(t.a, "POST", path, { slot: "back", contentType: "image/jpeg" });
  check("an upload with another type than signed → R2 refuses", (await upload(r.json.uploadUrl, "text/plain")).status === 403);
  r = await call(t.a, "PUT", path, { slot: "back", key: r.json.key });
  check("keeping a photo that was never uploaded → invalid", r.status === 400, r.status);
  r = await call(t.a, "PUT", path, { slot: "back", key: second });
  check("another slot's key → invalid", r.status === 400, r.status);
  const foreign = `firms/${ivanov}/couriers/${users.c}/shifts/${id}/front/0b5e3a52-6f1c-4d9e-9a51-2f6a1d0c7e44`;
  r = await call(t.a, "PUT", path, { slot: "front", key: foreign });
  check("another courier's prefix → invalid", r.status === 400, r.status);
  for (const [name, body] of [
    ["a slot that doesn't exist", { slot: "idCard", contentType: "image/jpeg" }],
    ["a PDF", { slot: "front", contentType: "application/pdf" }],
    ["an extra field", { slot: "front", contentType: "image/jpeg", userId: users.c }],
  ]) {
    r = await call(t.a, "POST", path, body);
    check(`${name} → invalid`, r.status === 400 && r.json?.error === "invalid", r.status);
  }
  r = await call(t.a, "DELETE", `${path}?slot=nope`);
  check("removing a slot that doesn't exist → invalid", r.status === 400, r.status);
  r = await call(t.a, "POST", "/api/shifts/not-an-id/photos", { slot: "front", contentType: "image/jpeg" });
  check("a malformed shift id → notFound", r.status === 404, r.status);

  // Other couriers, roles and firms on courier.a's shift.
  t = await tokens();
  r = await call(t.c, "POST", path, { slot: "back", contentType: "image/jpeg" });
  check("courier.c can't upload to courier.a's shift", r.status === 404, r.status);
  r = await call(t.c, "DELETE", `${path}?slot=front`);
  check("courier.c can't remove courier.a's photo", r.status === 404, r.status);
  r = await call(t.c, "GET", `/api/shifts/${id}`);
  check("courier.c can't read courier.a's shift photos", r.status === 404, r.status);
  r = await call(t.b, "POST", path, { slot: "back", contentType: "image/jpeg" });
  check("a Firm B courier can't reach an Ivanov shift", r.status === 404, r.status);
  for (const who of ["dispatcher", "owner"]) {
    r = await call(t[who], "POST", path, { slot: "back", contentType: "image/jpeg" });
    check(`${who} can't upload shift photos`, r.status === 403 && r.json?.error === "role", r.status);
  }
  check("courier.a's photo survived", (await headObject(second)) !== null);

  // Submitted: no more changes; reviewers see the photos.
  await call(t.a, "PATCH", "/api/shifts/today", { endKm: 1100, returned: 5 });
  r = await call(t.a, "POST", "/api/shifts/today/submit");
  check("courier.a submits", r.status === 200 && r.json?.status === "submitted", r.status);
  r = await call(t.a, "POST", path, { slot: "back", contentType: "image/jpeg" });
  check("a submitted shift takes no photos", r.status === 409 && r.json?.error === "notEditable", r.status);
  r = await call(t.a, "DELETE", `${path}?slot=front`);
  check("a submitted shift keeps its photos", r.status === 409 && (await headObject(second)) !== null, r.status);
  r = await call(t.a, "GET", `/api/shifts/${id}`);
  check("courier.a reads the photos on the shift", r.status === 200 && r.json?.photos?.front?.key === second, r.status);

  r = await call(t.dispatcher, "GET", `/api/approvals/${id}`);
  check(
    "dispatcher sees the photos in their depot",
    r.status === 200 && typeof r.json?.photos?.front?.url === "string" && Boolean(r.json?.photos?.extra1),
    r.status,
  );
  check("the detail counts expected photos only", r.json?.shift?.photoCount === 1);
  r = await call(t.owner, "GET", `/api/approvals/${id}`);
  check("owner sees the photos", r.status === 200 && r.json?.photos?.front?.key === second, r.status);
  r = await call(t.dispatcher, "GET", "/api/approvals?view=pending");
  check(
    "approval rows carry a photo count",
    r.status === 200 && r.json.items.length > 0 && r.json.items.every((i) => typeof i.shift.photoCount === "number"),
    r.status,
  );

  const [outside] = await sql`
    select s.id from shifts s join depots d on d.id = s.depot_id
    where s.firm_id = ${ivanov} and s.user_id = ${users.c} and d.name = 'HBW7' limit 1`;
  r = await call(t.dispatcher, "GET", `/api/approvals/${outside.id}`);
  check("dispatcher gets nothing outside their depots", r.status === 404, r.status);
  r = await call(t.owner, "GET", `/api/approvals/${outside.id}`);
  check("owner reads any depot's shift with photos", r.status === 200 && typeof r.json?.photos === "object", r.status);
  const [firmBShift] = await sql`select id from shifts where firm_id = ${firmB} limit 1`;
  r = await call(t.owner, "GET", `/api/approvals/${firmBShift.id}`);
  check("Ivanov owner can't read a Firm B shift", r.status === 404, r.status);

  // Rejected: the courier can add photos again before resubmitting.
  r = await call(t.dispatcher, "POST", `/api/approvals/${id}`, { action: "reject", reasons: ["km"] });
  check("dispatcher rejects the shift", r.status === 200 && r.json?.status === "rejected", r.status);
  t = await tokens();
  r = await call(t.a, "POST", path, { slot: "logbook", contentType: "image/jpeg" });
  check("a rejected shift takes photos", r.status === 200, r.status);
  await upload(r.json.uploadUrl);
  r = await call(t.a, "PUT", path, { slot: "logbook", key: r.json.key });
  check("the logbook photo is kept", r.status === 200 && Boolean(r.json?.logbook), r.status);
  r = await call(t.a, "GET", `/api/shifts/${id}`);
  check("the count follows", r.json?.shift?.photoCount === 2);
} finally {
  await clearToday();
  const left = await listKeys(`firms/${ivanov}/couriers/${users.a}/shifts/`);
  check("no shift photo files are left behind", left.length === 0, left.length);
}

finish("shift photo");
