// Depots-and-cars checks against a running dev server: only owners manage them, names and plates are unique and
// normalised, archiving keeps active cars out of archived depots, couriers' pickers follow it, and no firm reaches
// another's rows. Writes rows named "Check <run>" and deletes them at the end (no shift references them).
// Run with `npm run check:fleet` (after db:seed).
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

const run = Date.now().toString(36).toUpperCase();
const depotName = `Check ${run}`;
const plate = `CHK ${run}`;

try {
  // Owner: list.
  let r = await call(token.owner, "GET", "/api/fleet");
  const seeded = r.json?.depots ?? [];
  check("owner lists the firm's depots", r.status === 200 && seeded.length >= 3, r.status);
  check("each car sits under its own depot", seeded.every((d) => d.cars.every((c) => c.depotId === d.id)));
  const other = seeded.find((d) => !d.archived);

  // Depots: create, duplicate, rename.
  r = await call(token.owner, "POST", "/api/fleet/depots", { name: `  ${depotName}  ` });
  check("owner adds a depot (name trimmed)", r.status === 201 && r.json.name === depotName, r.status);
  const depot = r.json;
  r = await call(token.owner, "POST", "/api/fleet/depots", { name: depotName.toLowerCase() });
  check("duplicate name in another case is taken", r.status === 409 && r.json.error === "taken", r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${depot.id}`, { name: `${depotName} B` });
  check("owner renames a depot", r.status === 200 && r.json.name === `${depotName} B`, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${depot.id}`, { name: other.name });
  check("renaming onto another depot's name is taken", r.status === 409 && r.json.error === "taken", r.status);

  // Cars: create, duplicate, move.
  r = await call(token.owner, "POST", "/api/fleet/cars", { plate: ` ${plate.toLowerCase()} `, depotId: depot.id });
  check("owner adds a car (plate normalised)", r.status === 201 && r.json.plate === plate, `${r.status} ${r.json?.plate}`);
  const car = r.json;
  r = await call(token.owner, "POST", "/api/fleet/cars", { plate, depotId: other.id });
  check("duplicate plate is taken", r.status === 409 && r.json.error === "taken", r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { depotId: other.id });
  check("owner moves a car to another depot", r.status === 200 && r.json.depotId === other.id, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { depotId: depot.id, plate: `${plate} 2` });
  check("owner changes plate and depot together", r.status === 200 && r.json.plate === `${plate} 2`, r.status);

  // Archiving rules.
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${depot.id}`, { archived: true });
  check("a depot with active cars can't be archived", r.status === 409 && r.json.error === "depotHasCars", r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { archived: true });
  check("owner archives a car", r.status === 200 && r.json.archived === true, r.status);

  let today = await call(token.a, "GET", "/api/shifts/today");
  check("archived car leaves the courier's picker", !today.json.buses.some((b) => b.id === car.id));

  r = await call(token.owner, "PATCH", `/api/fleet/depots/${depot.id}`, { archived: true });
  check("owner archives the emptied depot", r.status === 200 && r.json.archived === true, r.status);
  today = await call(token.a, "GET", "/api/shifts/today");
  check("archived depot leaves the courier's picker", !today.json.stations.some((s) => s.id === depot.id));
  r = await call(token.owner, "POST", "/api/fleet/cars", { plate: `${plate} 3`, depotId: depot.id });
  check("no new car in an archived depot", r.status === 400, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { archived: false });
  check("a car can't be restored into an archived depot", r.status === 400 && r.json.error === "invalid", r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${depot.id}`, { archived: false });
  check("owner restores the depot", r.status === 200 && r.json.archived === false, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { archived: false });
  check("owner restores the car", r.status === 200 && r.json.archived === false, r.status);
  today = await call(token.a, "GET", "/api/shifts/today");
  check("restored car is back in the courier's picker", today.json.buses.some((b) => b.id === car.id));

  // Roles.
  const routes = [
    ["GET", "/api/fleet"],
    ["POST", "/api/fleet/depots", { name: `${depotName} X` }],
    ["PATCH", `/api/fleet/depots/${depot.id}`, { name: `${depotName} X` }],
    ["POST", "/api/fleet/cars", { plate: `${plate} X`, depotId: depot.id }],
    ["PATCH", `/api/fleet/cars/${car.id}`, { archived: true }],
  ];
  for (const [who, t] of [["dispatcher", token.dispatcher], ["courier", token.a], ["Firm B courier", token.b]]) {
    const results = await Promise.all(routes.map(([method, path, body]) => call(t, method, path, body)));
    check(`${who} gets 403 on every fleet route`, results.every((x) => x.status === 403 && x.json.error === "role"));
  }
  r = await call(null, "GET", "/api/fleet");
  check("no session gets 401", r.status === 401, r.status);

  // Tenant isolation.
  const [bDepot] = await sql`select id, name from depots where firm_id = ${firmB} limit 1`;
  const [bCar] = await sql`select id, plate, depot_id from cars where firm_id = ${firmB} limit 1`;
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${bDepot.id}`, { name: "Hijacked" });
  check("owner can't rename another firm's depot", r.status === 404, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/depots/${bDepot.id}`, { archived: true });
  check("owner can't archive another firm's depot", r.status === 404, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${bCar.id}`, { plate: "HIJACKED" });
  check("owner can't change another firm's car", r.status === 404, r.status);
  r = await call(token.owner, "POST", "/api/fleet/cars", { plate: `${plate} B`, depotId: bDepot.id });
  check("owner can't add a car to another firm's depot", r.status === 400, r.status);
  r = await call(token.owner, "PATCH", `/api/fleet/cars/${car.id}`, { depotId: bDepot.id });
  check("owner can't move a car into another firm's depot", r.status === 400, r.status);
  const [bDepotAfter] = await sql`select name, archived_at from depots where id = ${bDepot.id}`;
  const [bCarAfter] = await sql`select plate, depot_id from cars where id = ${bCar.id}`;
  check(
    "another firm's rows are unchanged",
    bDepotAfter.name === bDepot.name && !bDepotAfter.archived_at && bCarAfter.plate === bCar.plate,
  );
  r = await call(token.owner, "GET", "/api/fleet");
  const ids = new Set(r.json.depots.flatMap((d) => [d.id, ...d.cars.map((c) => c.id)]));
  check("owner's list has no other firm's rows", !ids.has(bDepot.id) && !ids.has(bCar.id));

  // Bad input.
  const bad = [
    ["POST", "/api/fleet/depots", { name: "   " }],
    ["POST", "/api/fleet/depots", { name: "x".repeat(61) }],
    ["POST", "/api/fleet/depots", { name: "Ok", extra: 1 }],
    ["POST", "/api/fleet/cars", { plate: "A$B", depotId: depot.id }],
    ["POST", "/api/fleet/cars", { plate: "X".repeat(16), depotId: depot.id }],
    ["POST", "/api/fleet/cars", { plate: "OK 1", depotId: "nope" }],
    ["PATCH", `/api/fleet/cars/${car.id}`, {}],
    ["PATCH", `/api/fleet/cars/${car.id}`, { archived: true, plate: "OK 2" }],
    ["PATCH", `/api/fleet/depots/${depot.id}`, { archived: "yes" }],
  ];
  const badResults = await Promise.all(bad.map(([method, path, body]) => call(token.owner, method, path, body)));
  check("bad bodies get 400", badResults.every((x) => x.status === 400), badResults.map((x) => x.status).join(","));
  r = await call(token.owner, "PATCH", "/api/fleet/depots/not-an-id", { name: "Ok" });
  check("a malformed id gets 404", r.status === 404, r.status);
} finally {
  await sql`delete from cars where firm_id = ${ivanov} and plate like ${`CHK ${run}%`}`;
  await sql`delete from depots where firm_id = ${ivanov} and name like ${`Check ${run}%`}`;
}

finish("fleet");
