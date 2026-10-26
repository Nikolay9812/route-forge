// Courier document checks against a running dev server: a courier reads and saves only their own documents, the
// owner reads and edits every courier of the firm, dispatchers and other firms get nothing, and bad input is
// refused; then document photos in R2 (prompts/17). Restores the seeded values and removes test photos at the end.
// Run with `npm run check:details` (after db:seed).
import { deleteObject, headObject } from "../src/server/storage.ts";
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

  await checkPhotos();
} finally {
  // Photos the checks left behind (rows and files), then the seeded values.
  for (const userId of [users.a, users.c]) {
    for (const row of await sql`select object_key from document_photos where firm_id = ${ivanov} and user_id = ${userId}`) {
      await deleteObject(row.object_key);
    }
    await sql`delete from document_photos where firm_id = ${ivanov} and user_id = ${userId}`;
  }
  if (seededContacts) await call(await tokenFor(users.a, ivanov), "PATCH", "/api/details", { section: "contacts", values: seededContacts });
  if (seededBank) {
    await call(await tokenFor(users.owner, ivanov), "PATCH", `/api/couriers/${users.c}`, { section: "bank", values: seededBank });
  }
}

/** Document photos in R2 (prompts/17-document-photos.md). Tokens last about a minute, so this block gets fresh ones. */
async function checkPhotos() {
  const t = {
    a: await tokenFor(users.a, ivanov),
    b: await tokenFor(users.b, firmB),
    dispatcher: await tokenFor(users.dispatcher, ivanov),
    owner: await tokenFor(users.owner, ivanov),
  };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
  const upload = (url, type = "image/jpeg") => fetch(url, { method: "PUT", body: jpeg, headers: { "Content-Type": type } });
  const front = { section: "idCard", slot: "front" };

  // Courier: start, upload, keep, show.
  let r = await call(t.a, "POST", "/api/details/photos", { ...front, contentType: "image/jpeg" });
  check("courier starts an upload", r.status === 200 && typeof r.json?.uploadUrl === "string", r.status);
  const first = r.json.key;
  check("the key sits under the courier's own prefix", first.startsWith(`firms/${ivanov}/couriers/${users.a}/idCard/front/`));
  check("the file goes straight to R2", (await upload(r.json.uploadUrl)).status === 200);
  r = await call(t.a, "PUT", "/api/details/photos", { ...front, key: first });
  const shown = r.json?.photos?.idCard?.front;
  check("courier keeps the photo", r.status === 200 && shown?.key === first, r.status);
  const view = await fetch(shown.url);
  check("the signed URL shows the same bytes", view.status === 200 && (await view.arrayBuffer()).byteLength === jpeg.length);
  check("the bucket itself is private", (await fetch(shown.url.split("?")[0])).status !== 200);
  r = await call(t.a, "GET", "/api/details");
  check("GET lists the photo", r.json?.photos?.idCard?.front?.key === first);
  const [row] = await sql`select uploaded_by, size from document_photos where firm_id = ${ivanov} and user_id = ${users.a}`;
  check("the row records the courier and the size", row?.uploaded_by === users.a && row?.size === jpeg.length);

  // Replacing deletes the old file.
  r = await call(t.a, "POST", "/api/details/photos", { ...front, contentType: "image/png" });
  await upload(r.json.uploadUrl, "image/png");
  const second = r.json.key;
  r = await call(t.a, "PUT", "/api/details/photos", { ...front, key: second });
  check("a new photo replaces the old one", r.json?.photos?.idCard?.front?.key === second);
  check("the replaced file is deleted", (await headObject(first)) === null);

  // Front and back of one section both come back.
  const back = { section: "idCard", slot: "back" };
  r = await call(t.a, "POST", "/api/details/photos", { ...back, contentType: "image/jpeg" });
  await upload(r.json.uploadUrl);
  await call(t.a, "PUT", "/api/details/photos", { ...back, key: r.json.key });
  r = await call(t.a, "GET", "/api/details");
  check("both sides of the ID card are listed", Boolean(r.json?.photos?.idCard?.front && r.json?.photos?.idCard?.back));
  await call(t.a, "DELETE", "/api/details/photos?section=idCard&slot=back");

  // What a courier can't do.
  r = await call(t.a, "POST", "/api/details/photos", { ...front, contentType: "image/jpeg" });
  check("an upload with another type than signed → R2 refuses", (await upload(r.json.uploadUrl, "text/plain")).status === 403);
  r = await call(t.a, "PUT", "/api/details/photos", { ...front, key: r.json.key });
  check("keeping a photo that was never uploaded → invalid", r.status === 400, r.status);
  const foreign = `firms/${ivanov}/couriers/${users.c}/idCard/front/${crypto.randomUUID()}`;
  r = await call(t.a, "PUT", "/api/details/photos", { ...front, key: foreign });
  check("keeping a key under courier.c's prefix → invalid", r.status === 400, r.status);
  r = await call(t.a, "PUT", "/api/details/photos", { section: "idCard", slot: "back", key: second });
  check("keeping another slot's key → invalid", r.status === 400, r.status);
  r = await call(t.a, "POST", "/api/details/photos", { section: "social", slot: "front", contentType: "image/jpeg" });
  check("a slot the section doesn't have → invalid", r.status === 400, r.status);
  r = await call(t.a, "POST", "/api/details/photos", { ...front, contentType: "application/pdf" });
  check("a type that isn't an image → invalid", r.status === 400, r.status);
  r = await call(t.a, "POST", "/api/details/photos", { ...front, contentType: "image/jpeg", userId: users.c });
  check("a user ID in the body → invalid", r.status === 400, r.status);

  // Remove.
  r = await call(t.a, "DELETE", "/api/details/photos?section=idCard&slot=front");
  check("courier removes the photo", r.status === 200 && !r.json?.photos?.idCard?.front, r.status);
  check("the removed file is deleted", (await headObject(second)) === null);
  r = await call(t.a, "DELETE", "/api/details/photos?section=idCard&slot=nope");
  check("removing a slot that doesn't exist → invalid", r.status === 400, r.status);

  // Owner: courier.c's photos.
  const licence = { section: "licence", slot: "back" };
  r = await call(t.owner, "POST", `/api/couriers/${users.c}/photos`, { ...licence, contentType: "image/jpeg" });
  check("owner starts an upload for courier.c", r.status === 200 && r.json.key.includes(`/couriers/${users.c}/`), r.status);
  await upload(r.json.uploadUrl);
  const owners = r.json.key;
  r = await call(t.owner, "PUT", `/api/couriers/${users.c}/photos`, { ...licence, key: owners });
  check("owner keeps it and sees it", r.status === 200 && r.json.photos?.licence?.back?.key === owners, r.status);
  const [ownerRow] = await sql`select uploaded_by from document_photos where firm_id = ${ivanov} and user_id = ${users.c}`;
  check("the row records the owner as uploader", ownerRow?.uploaded_by === users.owner);
  r = await call(t.owner, "GET", `/api/couriers/${users.c}`);
  check("owner reads courier.c's photo with a signed URL", typeof r.json?.photos?.licence?.back?.url === "string");

  // Roles.
  for (const [method, path, body] of [
    ["POST", "/api/details/photos", { ...front, contentType: "image/jpeg" }],
    ["POST", `/api/couriers/${users.c}/photos`, { ...licence, contentType: "image/jpeg" }],
    ["DELETE", `/api/couriers/${users.c}/photos?section=licence&slot=back`],
  ]) {
    r = await call(t.dispatcher, method, path, body);
    check(`dispatcher ${method} ${path.split("?")[0]} → role`, r.status === 403 && r.json?.error === "role", r.status);
  }
  r = await call(t.a, "DELETE", `/api/couriers/${users.c}/photos?section=licence&slot=back`);
  check("a courier can't remove courier.c's photo", r.status === 403 && r.json?.error === "role", r.status);
  r = await call(t.owner, "POST", "/api/details/photos", { ...front, contentType: "image/jpeg" });
  check("an owner has no own photos route", r.status === 403 && r.json?.error === "role", r.status);
  check("courier.c's photo survived", (await headObject(owners)) !== null);

  // Tenant isolation.
  r = await call(t.owner, "POST", `/api/couriers/${users.b}/photos`, { ...front, contentType: "image/jpeg" });
  check("Ivanov owner can't upload for a Firm B courier", r.status === 404, r.status);
  r = await call(t.owner, "DELETE", `/api/couriers/${users.b}/photos?section=idCard&slot=front`);
  check("Ivanov owner can't remove a Firm B photo", r.status === 404, r.status);
  r = await call(t.b, "PUT", "/api/details/photos", { ...licence, key: owners });
  check("a Firm B courier can't claim an Ivanov key", r.status === 400, r.status);
  r = await call(t.b, "GET", "/api/details");
  check("courier.b sees no photos of Ivanov", r.status === 200 && Object.keys(r.json.photos).length === 0, r.status);
}

finish("courier document");
