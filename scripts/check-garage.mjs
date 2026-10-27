// Mechanic and service log checks against a running dev server (prompts/23): only mechanics and owners reach the
// garage and notes, mechanics see active cars with papers and talon but only 7 days of vehicle checks and never
// shift details, authors change their notes for 7 days, owners delete any, note photos live under the note and go
// with it, and no firm reaches another's cars or notes. Deletes the notes it adds and restores what it archives.
// Run with `npm run check:garage` (after db:seed; dev only).
import { addDays } from "../src/domain/car-notes.ts";
import { headObject } from "../src/server/storage.ts";
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
  mechanic: await userByEmail("mechanic+clerk_test@example.com"),
};
// Tokens last about a minute, so each block asks for fresh ones.
const tokens = async () => ({
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
  mechanic: await tokenFor(users.mechanic, ivanov),
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const upload = (url) => fetch(url, { method: "PUT", body: jpeg, headers: { "Content-Type": "image/jpeg" } });

const [car] = await sql`select id from cars where firm_id = ${ivanov} and plate = 'KH I 6004'`;
const [spare] = await sql`select id from cars where firm_id = ${ivanov} and plate = 'KH I 7732'`;
const [bCar] = await sql`select id from cars where firm_id = ${firmB} limit 1`;
const [bShift] = await sql`select id from shifts where firm_id = ${firmB} order by date desc limit 1`;
const [lockedNote] = await sql`
  select id from car_notes where firm_id = ${ivanov} and created_by = ${users.mechanic} and type = 'other'`;
const added = [];

try {
  let t = await tokens();

  // Roles: only mechanics and owners.
  const reads = ["/api/garage", `/api/garage/cars/${car.id}`, "/api/car-notes", `/api/car-notes/${lockedNote.id}`];
  for (const [who, token] of [["dispatcher", t.dispatcher], ["courier", t.a], ["Firm B courier", t.b]]) {
    const results = await Promise.all([
      ...reads.map((p) => call(token, "GET", p)),
      call(token, "POST", "/api/car-notes", { carId: car.id, type: "oil", doneOn: "2026-01-01", km: null, text: null }),
      call(token, "DELETE", `/api/car-notes/${lockedNote.id}`),
    ]);
    check(`${who} gets 403 on the garage and notes`, results.every((x) => x.status === 403 && x.json.error === "role"));
  }
  check("no session gets 401", (await call(null, "GET", "/api/garage")).status === 401);

  // Mechanic: the firm's active cars.
  let r = await call(t.mechanic, "GET", "/api/garage");
  const today = r.json?.today;
  const listed = r.json?.depots.flatMap((d) => d.cars) ?? [];
  check("mechanic lists the firm's cars", r.status === 200 && listed.length === 3, `${r.status} ${listed.length}`);
  check("cars carry warnings and the last note day", listed.find((c) => c.id === car.id)?.lastNoteOn === today);
  check("no Firm B car is listed", !listed.some((c) => c.id === bCar.id));

  // One car: papers with the talon, 7 days of checks, no shift details.
  r = await call(t.mechanic, "GET", `/api/garage/cars/${car.id}`);
  const detail = r.json;
  check("mechanic reads a car's papers", r.status === 200 && detail.car.papers.vin === "ZFA250006SMC06228", r.status);
  check("the car has a depot name and odometer", detail?.car.depotName === "HBW3" && detail.car.odometerKm > 0);
  check("the papers warn (TÜV and service)", detail?.car.warnings.length >= 2);
  const from = addDays(today, -6);
  check("checks are within the last 7 days", detail?.checks.length > 0 && detail.checks.every((c) => c.date >= from && c.date <= today));
  check("checks are newest first", detail?.checks.every((c, i, all) => i === 0 || all[i - 1].date >= c.date));
  check("checks carry the courier's name", detail?.checks.every((c) => c.courierName.length > 0));
  check(
    "checks carry no shift details",
    detail?.checks.every((c) => Object.keys(c).sort().join() === "courierName,date,photoCount,shiftId"),
  );
  check("the car carries its latest notes", detail?.notes.length === 4 && detail.notes[0].doneOn === today);
  const [inRange] = await sql`select id::text, date::text from shifts where firm_id = ${ivanov} and car_id = ${car.id} and date >= ${from} order by date limit 1`;
  const [old] = await sql`select id::text from shifts where firm_id = ${ivanov} and car_id = ${car.id} and date < ${from} order by date desc limit 1`;
  r = await call(t.mechanic, "GET", `/api/garage/shifts/${inRange.id}`);
  check("mechanic opens a recent check", r.status === 200 && r.json.date === inRange.date && r.json.plate === "KH I 6004", r.status);
  check("a check carries no shift details", r.json && Object.keys(r.json).sort().join() === "courierName,date,photos,plate,shiftId");
  r = await call(t.mechanic, "GET", `/api/garage/shifts/${old.id}`);
  check("a check older than 7 days is 404", r.status === 404, r.status);
  r = await call(t.mechanic, "GET", `/api/garage/shifts/${bShift.id}`);
  check("another firm's shift is 404", r.status === 404, r.status);
  r = await call(t.mechanic, "GET", `/api/garage/cars/${bCar.id}`);
  check("another firm's car is 404", r.status === 404, r.status);

  // Mechanics never reach the owner's or reviewers' routes.
  const ownerRoutes = [
    ["GET", "/api/fleet"],
    ["GET", `/api/fleet/cars/${car.id}`],
    ["PATCH", `/api/fleet/cars/${car.id}`, { archived: true }],
    ["POST", `/api/fleet/cars/${car.id}/photos`, { slot: "talon", contentType: "image/jpeg" }],
    ["GET", "/api/approvals?view=pending"],
    ["GET", "/api/team"],
    ["GET", "/api/people"],
    ["GET", "/api/pay-rates"],
    ["GET", "/api/couriers"],
    ["GET", "/api/firm"],
    ["GET", "/api/shifts/today"],
    ["GET", "/api/pay?month=2026-01"],
  ];
  const denied = await Promise.all(ownerRoutes.map(([m, p, b]) => call(t.mechanic, m, p, b)));
  check("mechanic gets 403 on owner, reviewer and courier routes", denied.every((x) => x.status === 403), denied.map((x) => x.status).join(","));

  // Archived cars drop out of the garage.
  r = await call(t.owner, "PATCH", `/api/fleet/cars/${spare.id}`, { archived: true });
  check("owner archives a car", r.status === 200, r.status);
  r = await call(t.mechanic, "GET", "/api/garage");
  check("an archived car isn't listed", !r.json.depots.flatMap((d) => d.cars).some((c) => c.id === spare.id));
  r = await call(t.mechanic, "GET", `/api/garage/cars/${spare.id}`);
  check("an archived car is 404 for mechanics", r.status === 404, r.status);
  r = await call(t.mechanic, "POST", "/api/car-notes", { carId: spare.id, type: "oil", doneOn: today, km: null, text: null });
  check("no notes on an archived car", r.status === 400, r.status);
  await call(t.owner, "PATCH", `/api/fleet/cars/${spare.id}`, { archived: false });

  // Notes: add, validate, edit.
  const body = { carId: car.id, type: "oil", doneOn: addDays(today, -2), km: 58_100, text: " Oil 5W-30 " };
  r = await call(t.mechanic, "POST", "/api/car-notes", body);
  const note = r.json;
  if (note?.id) added.push(note.id);
  check("mechanic adds a note", r.status === 201 && note.text === "Oil 5W-30" && note.plate === "KH I 6004", r.status);
  check("the note says who wrote it", note?.byName === "Max Mechanic" && note.canEdit && note.canDelete && !note.edited);
  const bad = [
    { ...body, doneOn: addDays(today, 1) },
    { ...body, type: "wheels" },
    { ...body, type: "other", text: null },
    { ...body, km: -1 },
    { ...body, carId: "nope" },
    { ...body, createdBy: users.owner },
  ];
  const badResults = await Promise.all(bad.map((b) => call(t.mechanic, "POST", "/api/car-notes", b)));
  check("bad notes get 400", badResults.every((x) => x.status === 400), badResults.map((x) => x.status).join(","));
  r = await call(t.mechanic, "POST", "/api/car-notes", { ...body, carId: bCar.id });
  check("a note on another firm's car is 404", r.status === 404, r.status);

  const { carId: _carId, ...whole } = body;
  r = await call(t.mechanic, "PATCH", `/api/car-notes/${note.id}`, { ...whole, type: "tyres", text: "Summer tyres" });
  check("the author edits within 7 days", r.status === 200 && r.json.type === "tyres" && r.json.edited, r.status);
  r = await call(t.mechanic, "PATCH", `/api/car-notes/${note.id}`, { ...whole, carId: spare.id });
  check("the car can't change", r.status === 400, r.status);
  r = await call(t.owner, "PATCH", `/api/car-notes/${note.id}`, whole);
  check("the owner can't edit someone else's note", r.status === 409 && r.json.error === "notEditable", r.status);
  r = await call(t.owner, "GET", `/api/car-notes/${note.id}`);
  check("the owner sees it but may only delete", r.status === 200 && !r.json.canEdit && r.json.canDelete, r.status);
  r = await call(t.mechanic, "PATCH", `/api/car-notes/${lockedNote.id}`, { type: "other", doneOn: addDays(today, -10), km: null, text: "x" });
  check("a note older than 7 days is locked", r.status === 409 && r.json.error === "notEditable", r.status);
  r = await call(t.mechanic, "DELETE", `/api/car-notes/${lockedNote.id}`);
  check("its author can't delete it either", r.status === 409, r.status);
  r = await call(t.mechanic, "GET", `/api/car-notes/${lockedNote.id}`);
  check("it reads as locked", r.status === 200 && !r.json.canEdit && !r.json.canDelete, r.status);

  t = await tokens();

  // Note photos.
  const photos = `/api/car-notes/${note.id}/photos`;
  r = await call(t.mechanic, "POST", photos, { slot: "photo1", contentType: "image/jpeg" });
  check("the author starts a photo upload", r.status === 200 && r.json.key.startsWith(`firms/${ivanov}/cars/${car.id}/notes/${note.id}/photo1/`), r.status);
  const key = r.json.key;
  check("the file goes straight to R2", (await upload(r.json.uploadUrl)).status === 200);
  r = await call(t.mechanic, "PUT", photos, { slot: "photo1", key });
  check("the author keeps the photo", r.status === 200 && r.json.photos.photo1?.key === key && r.json.photoCount === 1, r.status);
  check("the photo URL is signed", (await fetch(r.json.photos.photo1.url)).status === 200);
  r = await call(t.mechanic, "PUT", photos, { slot: "photo2", key: `firms/${ivanov}/cars/${car.id}/talon/${crypto.randomUUID()}` });
  check("a key outside the note is invalid", r.status === 400, r.status);
  r = await call(t.owner, "POST", photos, { slot: "photo2", contentType: "image/jpeg" });
  check("only the author adds photos", r.status === 409, r.status);
  r = await call(t.mechanic, "POST", `/api/car-notes/${lockedNote.id}/photos`, { slot: "photo1", contentType: "image/jpeg" });
  check("no photos on a locked note", r.status === 409, r.status);

  // The service log: filters and paging.
  r = await call(t.owner, "GET", "/api/car-notes");
  check("the owner reads the log, newest first", r.status === 200 && r.json.notes.length === 7 && r.json.notes[0].doneOn === today, r.status);
  check("the log lists every car for the filter", r.json?.cars.length === 3 && r.json.next === null);
  r = await call(t.owner, "GET", `/api/car-notes?carId=${car.id}&type=tyres`);
  check("filters by car and type", r.json?.notes.length === 2 && r.json.notes.every((n) => n.type === "tyres" && n.carId === car.id));
  r = await call(t.owner, "GET", "/api/car-notes?type=wheels");
  check("an unknown type is 400", r.status === 400, r.status);
  r = await call(t.b, "GET", "/api/car-notes");
  check("a Firm B courier gets nothing", r.status === 403, r.status);
  const all = (await call(t.owner, "GET", "/api/car-notes")).json.notes;
  const cursor = `${all[2].doneOn}|${all[2].createdAt}|${all[2].id}`;
  r = await call(t.owner, "GET", `/api/car-notes?before=${encodeURIComponent(cursor)}`);
  check("a cursor answers the notes after it", r.json?.notes.map((n) => n.id).join() === all.slice(3).map((n) => n.id).join());

  // The owner deletes any note, and its photo goes with it.
  r = await call(t.owner, "DELETE", `/api/car-notes/${note.id}`);
  check("the owner deletes a mechanic's note", r.status === 200, r.status);
  check("its photo file is gone", (await headObject(key)) === null);
  const [gone] = await sql`select count(*)::int as n from car_note_photos where note_id = ${note.id}`;
  check("its photo row is gone", gone.n === 0);
  r = await call(t.mechanic, "GET", `/api/car-notes/${note.id}`);
  check("a deleted note is 404", r.status === 404, r.status);
  added.length = 0;

  // The author deletes their own; another firm's owner can't.
  r = await call(t.mechanic, "POST", "/api/car-notes", { ...body, type: "brakes", text: null });
  added.push(r.json.id);
  r = await call(t.b, "DELETE", `/api/car-notes/${r.json.id}`);
  check("a Firm B user can't delete it", r.status === 403, r.status);
  r = await call(t.mechanic, "DELETE", `/api/car-notes/${added[0]}`);
  check("the author deletes their own note", r.status === 200, r.status);
  added.length = 0;
} finally {
  const t = await tokenFor(users.owner, ivanov);
  for (const id of added) await call(t, "DELETE", `/api/car-notes/${id}`);
  await call(t, "PATCH", `/api/fleet/cars/${spare.id}`, { archived: false });
}

finish("garage");
