// Car papers and talon photo checks against a running dev server (prompts/19): only owners read and save a car's
// papers and photo, VINs are normalised and unique per firm, replacing or removing the photo deletes its file, a
// courier sees only their own shift car's VIN, and no firm reaches another's cars. Restores the seeded papers of
// the car it uses and removes its photo at the end. Run with `npm run check:car-papers` (after db:seed; dev only).
import { headObject } from "../src/server/storage.ts";
import { call, check, finish, orgByName, sql, tokenFor, userByEmail } from "./lib/api-test.mjs";

const ivanov = await orgByName("Ivanov Transport");
const firmB = await orgByName("Test Firm B");
const users = {
  a: await userByEmail("courier.a+clerk_test@example.com"),
  b: await userByEmail("courier.b+clerk_test@example.com"),
  dispatcher: await userByEmail("dispatcher+clerk_test@example.com"),
  owner: await userByEmail("owner+clerk_test@example.com"),
};
// Tokens last about a minute, so each block asks for fresh ones.
const tokens = async () => ({
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const upload = (url, type = "image/jpeg") => fetch(url, { method: "PUT", body: jpeg, headers: { "Content-Type": type } });

// Dates as text: the driver would turn them into local midnights.
const [car] = await sql`
  select id, vin, tuv_due_on::text, insurance_expires_on::text, service_due_on::text, service_due_km
  from cars where firm_id = ${ivanov} and plate = 'KH I 6004'`;
const [other] = await sql`select id, vin from cars where firm_id = ${ivanov} and plate = 'KH I 5120'`;
const [bCar] = await sql`select id, vin from cars where firm_id = ${firmB} limit 1`;
const seededPapers = {
  vin: car.vin,
  tuvDue: car.tuv_due_on?.slice(0, 7) ?? null,
  insuranceExpiresOn: car.insurance_expires_on,
  serviceDueOn: car.service_due_on,
  serviceDueKm: car.service_due_km,
};
const path = `/api/fleet/cars/${car.id}`;
const photos = `${path}/photos`;
const none = { vin: null, tuvDue: null, insuranceExpiresOn: null, serviceDueOn: null, serviceDueKm: null };

try {
  let t = await tokens();

  // Owner: the list carries papers, odometer and today; the detail adds the photo.
  let r = await call(t.owner, "GET", "/api/fleet");
  const listed = r.json?.depots.flatMap((d) => d.cars).find((c) => c.id === car.id);
  check("fleet answers the firm's today", r.status === 200 && /^\d{4}-\d{2}-\d{2}$/.test(r.json.today), r.status);
  check("a fleet car carries its papers", listed?.papers.vin === "ZFA250006SMC06228" && listed.papers.tuvDue?.length === 7);
  check("a fleet car carries its odometer", typeof listed?.odometerKm === "number" && listed.odometerKm > 0);
  check("the seeded service km is 600 ahead", listed?.papers.serviceDueKm === listed?.odometerKm + 600);
  r = await call(t.owner, "GET", path);
  check("owner reads a car", r.status === 200 && r.json.plate === "KH I 6004" && r.json.hasTalon === false, r.status);

  // Save papers: normalised, saved whole, who and when.
  const papers = {
    vin: " zfa 250006 smc-06228 ",
    tuvDue: "2028-02",
    insuranceExpiresOn: "2027-05-31",
    serviceDueOn: null,
    serviceDueKm: 250000,
  };
  r = await call(t.owner, "PATCH", path, { papers });
  check(
    "owner saves papers (VIN normalised)",
    r.status === 200 && r.json.papers.vin === "ZFA250006SMC06228" && r.json.papers.tuvDue === "2028-02",
    `${r.status} ${r.json?.papers?.vin}`,
  );
  check("the save records when", typeof r.json?.papersUpdatedAt === "string");
  const [stored] = await sql`select tuv_due_on::text, papers_updated_by from cars where id = ${car.id}`;
  check("TÜV month is stored as its last day", stored.tuv_due_on === "2028-02-29", stored.tuv_due_on);
  check("the save records who", stored.papers_updated_by === users.owner);
  r = await call(t.owner, "PATCH", `/api/fleet/cars/${other.id}`, { papers: { ...none, vin: "ZFA250006SMC06228" } });
  check("another car's VIN is taken", r.status === 409 && r.json.error === "taken", r.status);
  check("Firm B has the same VIN (unique per firm only)", bCar.vin === "ZFA250006SMC06228");

  // Bad papers.
  const bad = [
    { papers: { ...none, vin: "ZFA250006SMC0622O" } },
    { papers: { ...none, vin: "SHORT" } },
    { papers: { ...none, tuvDue: "2028-13" } },
    { papers: { ...none, insuranceExpiresOn: "2027-02-30" } },
    { papers: { ...none, serviceDueKm: -5 } },
    { papers: { vin: null } },
    { papers: none, plate: "KH I 9999" },
    { papers: none, archived: true },
  ];
  const badResults = await Promise.all(bad.map((body) => call(t.owner, "PATCH", path, body)));
  check("bad papers get 400", badResults.every((x) => x.status === 400), badResults.map((x) => x.status).join(","));

  // Talon photo: start, upload, keep, replace, remove.
  r = await call(t.owner, "POST", photos, { slot: "talon", contentType: "image/jpeg" });
  check("owner starts a talon upload", r.status === 200 && typeof r.json?.uploadUrl === "string", r.status);
  check("the key is under this car", r.json?.key.startsWith(`firms/${ivanov}/cars/${car.id}/talon/`));
  const first = r.json.key;
  check("the file goes straight to R2", (await upload(r.json.uploadUrl)).status === 200);
  r = await call(t.owner, "PUT", photos, { slot: "talon", key: first });
  check("owner keeps the talon", r.status === 200 && r.json.hasTalon && r.json.photos.talon?.key === first, r.status);
  check("the detail signs the talon URL", (await fetch(r.json.photos.talon.url)).status === 200);
  r = await call(t.owner, "POST", photos, { slot: "talon", contentType: "image/png" });
  const second = r.json.key;
  await upload(r.json.uploadUrl, "image/png");
  r = await call(t.owner, "PUT", photos, { slot: "talon", key: second });
  check("owner replaces the talon", r.status === 200 && r.json.photos.talon?.key === second, r.status);
  check("replacing deletes the old file", (await headObject(first)) === null);
  r = await call(t.owner, "PUT", photos, { slot: "talon", key: `firms/${ivanov}/cars/${other.id}/talon/${crypto.randomUUID()}` });
  check("another car's key is invalid", r.status === 400, r.status);
  r = await call(t.owner, "PUT", photos, { slot: "talon", key: `firms/${ivanov}/cars/${car.id}/talon/${crypto.randomUUID()}` });
  check("a key with no file is invalid", r.status === 400, r.status);
  r = await call(t.owner, "POST", photos, { slot: "front", contentType: "image/jpeg" });
  check("an unknown slot is invalid", r.status === 400, r.status);
  r = await call(t.owner, "POST", photos, { slot: "talon", contentType: "application/pdf" });
  check("a PDF is invalid", r.status === 400, r.status);

  t = await tokens();

  // Roles: every car route is owner-only.
  const routes = [
    ["GET", path],
    ["PATCH", path, { papers: none }],
    ["POST", photos, { slot: "talon", contentType: "image/jpeg" }],
    ["PUT", photos, { slot: "talon", key: second }],
    ["DELETE", `${photos}?slot=talon`],
  ];
  for (const [who, token] of [["dispatcher", t.dispatcher], ["courier", t.a], ["Firm B courier", t.b]]) {
    const results = await Promise.all(routes.map(([method, p, body]) => call(token, method, p, body)));
    check(`${who} gets 403 on every car route`, results.every((x) => x.status === 403 && x.json.error === "role"));
  }
  r = await call(null, "GET", path);
  check("no session gets 401", r.status === 401, r.status);

  // Tenant isolation: Ivanov's owner can't reach Firm B's car.
  r = await call(t.owner, "GET", `/api/fleet/cars/${bCar.id}`);
  check("owner can't read another firm's car", r.status === 404, r.status);
  r = await call(t.owner, "PATCH", `/api/fleet/cars/${bCar.id}`, { papers: none });
  check("owner can't save another firm's papers", r.status === 404, r.status);
  r = await call(t.owner, "POST", `/api/fleet/cars/${bCar.id}/photos`, { slot: "talon", contentType: "image/jpeg" });
  check("owner can't upload to another firm's car", r.status === 404, r.status);
  const [bAfter] = await sql`select vin from cars where id = ${bCar.id}`;
  check("another firm's papers are unchanged", bAfter.vin === bCar.vin);
  r = await call(t.owner, "GET", "/api/fleet/cars/not-an-id");
  check("a malformed id gets 404", r.status === 404, r.status);

  // Courier: the shift's car carries its VIN, the bus list never does.
  r = await call(t.a, "GET", "/api/shifts/today");
  check("the courier's bus list has no VINs", r.status === 200 && r.json.buses.every((b) => !("vin" in b)), r.status);
  r = await call(t.a, "GET", "/api/home");
  const recent = r.json?.recent ?? [];
  const withCar = recent.find((s) => s.car.id === car.id);
  check("a courier's shift carries its car's VIN", withCar?.car.vin === "ZFA250006SMC06228", withCar?.car.vin);
  check("every shift car has a vin field", recent.every((s) => "vin" in s.car));

  // Remove.
  r = await call(t.owner, "DELETE", `${photos}?slot=talon`);
  check("owner removes the talon", r.status === 200 && r.json.hasTalon === false, r.status);
  check("removing deletes the file", (await headObject(second)) === null);
  r = await call(t.owner, "DELETE", `${photos}?slot=talon`);
  check("removing an empty slot is fine", r.status === 200, r.status);
} finally {
  const t = await tokens();
  await call(t.owner, "DELETE", `${photos}?slot=talon`);
  await call(t.owner, "PATCH", path, { papers: seededPapers });
}

finish("car papers");
