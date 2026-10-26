// Courier document checks against a running dev server: a courier reads and saves only their own documents, the
// owner reads and edits every courier of the firm, dispatchers and other firms get nothing, and bad input is
// refused. Saves the seeded values back at the end. Run with `npm run check:details` (after db:seed).
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
const token = {
  a: await tokenFor(users.a, ivanov),
  b: await tokenFor(users.b, firmB),
  dispatcher: await tokenFor(users.dispatcher, ivanov),
  owner: await tokenFor(users.owner, ivanov),
};

const pick = (details, keys) => Object.fromEntries(keys.map((k) => [k, details[k]]));
const contactKeys = ["phone", "emergencyName", "emergencyPhone"];
const bankKeys = ["bankHolder", "iban"];
let seededContacts = null;
let seededBank = null;

try {
  // Courier: own documents.
  let r = await call(token.a, "GET", "/api/details");
  check("courier reads their own documents", r.status === 200 && r.json.userId === users.a, r.status);
  const sections = r.json?.sections ?? {};
  check(
    "courier.a's seeded sections are all complete",
    Object.values(sections).every((s) => s.state === "complete"),
    JSON.stringify(sections),
  );
  check("courier.a's ID card expires soon", sections.idCard?.warning === "expiresSoon", sections.idCard?.warning);
  seededContacts = pick(r.json.details, contactKeys);

  r = await call(token.a, "PATCH", "/api/details", {
    section: "contacts",
    values: { phone: " +49 170  1112223 ", emergencyName: "Check Contact", emergencyPhone: "" },
  });
  check(
    "courier saves contacts (whitespace collapsed, empty cleared)",
    r.status === 200 && r.json.details.phone === "+49 170 1112223" && r.json.details.emergencyPhone === null,
    r.status,
  );
  check("a cleared field makes the section incomplete", r.json?.sections.contacts.state === "incomplete");
  r = await call(token.a, "GET", "/api/details");
  check("the save reads back", r.json?.details.emergencyName === "Check Contact");
  r = await call(token.a, "PATCH", "/api/details", { section: "contacts", values: seededContacts, userId: users.c });
  check("a courier can't address another courier", r.status === 400, r.status);
  const [cRow] = await sql`select phone from courier_details where firm_id = ${ivanov} and user_id = ${users.c}`;
  check("courier.c's row is untouched", cRow?.phone == null);

  // Owner: list, one courier, edit.
  r = await call(token.owner, "GET", "/api/couriers");
  const list = r.json?.couriers ?? [];
  const a = list.find((c) => c.userId === users.a);
  const c = list.find((c) => c.userId === users.c);
  check("owner lists the firm's couriers", r.status === 200 && Boolean(a && c), r.status);
  check("courier.a counts 8 done (contacts now incomplete) and 1 expiring", a?.complete === 8 && a?.expiring === 1, JSON.stringify(a));
  check("courier.c counts 3 done (tax, bank, the old Führungszeugnis) and 1 expiring", c?.complete === 3 && c?.expiring === 1, JSON.stringify(c));
  check("no Firm B courier in the list", !list.some((x) => x.userId === users.b));

  r = await call(token.owner, "GET", `/api/couriers/${users.c}`);
  check("owner reads courier.c", r.status === 200 && r.json.details.nationality === "Romanian", r.status);
  check("courier.c's Führungszeugnis is too old", r.json?.sections.criminalRecord.warning === "tooOld");
  seededBank = pick(r.json.details, bankKeys);
  r = await call(token.owner, "PATCH", `/api/couriers/${users.c}`, {
    section: "bank",
    values: { bankHolder: "Courier C Check", iban: "de89 3704 0044 0532 0130 00" },
  });
  check("owner edits courier.c's bank (IBAN normalised)", r.status === 200 && r.json.details.iban === "DE89370400440532013000", r.status);
  const [edited] = await sql`select updated_by from courier_details where firm_id = ${ivanov} and user_id = ${users.c}`;
  check("the row records the owner as last editor", edited?.updated_by === users.owner);

  // Roles.
  for (const [who, t] of [["dispatcher", token.dispatcher]]) {
    for (const [method, path] of [
      ["GET", "/api/details"],
      ["GET", "/api/couriers"],
      ["GET", `/api/couriers/${users.a}`],
      ["PATCH", `/api/couriers/${users.a}`],
    ]) {
      r = await call(t, method, path, method === "PATCH" ? { section: "contacts", values: seededContacts } : undefined);
      check(`${who} ${method} ${path} → role`, r.status === 403 && r.json?.error === "role", r.status);
    }
  }
  r = await call(token.a, "GET", "/api/couriers");
  check("a courier can't list couriers", r.status === 403 && r.json?.error === "role", r.status);
  r = await call(token.a, "GET", `/api/couriers/${users.c}`);
  check("a courier can't read another courier", r.status === 403 && r.json?.error === "role", r.status);
  r = await call(token.owner, "GET", "/api/details");
  check("an owner has no own documents route", r.status === 403 && r.json?.error === "role", r.status);
  r = await call(null, "GET", "/api/details");
  check("signed out → unauthorized", r.status === 401, r.status);

  // Tenant isolation.
  const [bBefore] = await sql`select phone from courier_details where firm_id = ${firmB} and user_id = ${users.b}`;
  r = await call(token.owner, "GET", `/api/couriers/${users.b}`);
  check("Ivanov owner can't read a Firm B courier", r.status === 404, r.status);
  r = await call(token.owner, "PATCH", `/api/couriers/${users.b}`, { section: "contacts", values: seededContacts });
  check("Ivanov owner can't edit a Firm B courier", r.status === 404, r.status);
  r = await call(token.owner, "GET", "/api/couriers/user_doesnotexist");
  check("an unknown user is not found", r.status === 404, r.status);
  const [bAfter] = await sql`select phone from courier_details where firm_id = ${firmB} and user_id = ${users.b}`;
  check("courier.b's row is unchanged", bBefore?.phone === bAfter?.phone && Boolean(bAfter?.phone));
  r = await call(token.b, "GET", "/api/details");
  check("courier.b sees only their own firm's row", r.status === 200 && r.json.details.idNumber === null, r.status);

  // Bad input.
  const idCard = {
    idNumber: "X1",
    nationality: "German",
    placeOfBirth: "Berlin",
    birthDate: "1990-01-01",
    gender: "female",
    idAddress: "Somewhere 1",
    idIssuedOn: "2020-01-01",
    idExpiresOn: "2030-01-01",
  };
  const bad = [
    ["an unknown section", { section: "passport", values: {} }],
    ["a key from another section", { section: "bank", values: { bankHolder: "A", iban: null, phone: "+49 1234567" } }],
    ["a missing key", { section: "bank", values: { bankHolder: "A" } }],
    ["a bad IBAN checksum", { section: "bank", values: { bankHolder: "A", iban: "DE89370400440532013001" } }],
    ["a 10-digit Steuer-ID", { section: "tax", values: { taxId: "1234567890", taxClass: 1 } }],
    ["tax class 7", { section: "tax", values: { taxId: "12345678903", taxClass: 7 } }],
    ["a future birth date", { section: "idCard", values: { ...idCard, birthDate: "2090-01-01" } }],
    ["expiry before issue", { section: "idCard", values: { ...idCard, idExpiresOn: "2019-01-01" } }],
    ["a 6-digit postcode", { section: "address", values: { street: "A 1", postcode: "123456", city: "Köln" } }],
    ["an unknown licence class", { section: "licence", values: { licenceNumber: null, licenceClasses: ["Z"], licenceIssuedOn: null, licenceExpiresOn: null } }],
    ["an unknown gender", { section: "idCard", values: { ...idCard, gender: "x" } }],
    ["a too-long name", { section: "bank", values: { bankHolder: "A".repeat(81), iban: null } }],
    ["a non-object body", ["contacts"]],
  ];
  for (const [name, body] of bad) {
    r = await call(token.a, "PATCH", "/api/details", body);
    check(`${name} → invalid`, r.status === 400 && r.json?.error === "invalid", r.status);
  }
} finally {
  if (seededContacts) await call(await tokenFor(users.a, ivanov), "PATCH", "/api/details", { section: "contacts", values: seededContacts });
  if (seededBank) {
    await call(await tokenFor(users.owner, ivanov), "PATCH", `/api/couriers/${users.c}`, { section: "bank", values: seededBank });
  }
}

finish("courier document");
