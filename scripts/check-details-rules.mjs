// Hand-checked rules for courier documents (prompts/16-courier-documents.md). Run with
// `node --no-warnings scripts/check-details-rules.mjs` (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import {
  checkSection,
  emptyDetails,
  formatIban,
  monthsBefore,
  normalizeHealthNumber,
  normalizeIban,
  normalizeSocialNumber,
  normalizeTaxId,
  parseDetailsPatch,
  sectionFields,
  sectionState,
} from "../src/domain/courier-details.ts";

const today = "2026-10-26";

// Formats.
assert.equal(normalizeIban("de89 3704 0044 0532 0130 00"), "DE89370400440532013000");
assert.equal(normalizeIban("DE89 3704 0044 0532 0130 01"), null, "one digit changed breaks the checksum");
assert.equal(formatIban("DE89370400440532013000"), "DE89 3704 0044 0532 0130 00");
assert.equal(normalizeTaxId("12 345 678 901"), "12345678901");
assert.equal(normalizeTaxId("1234567890"), null);
assert.equal(normalizeSocialNumber("65 170839 j 003"), "65170839J003");
assert.equal(normalizeSocialNumber("65170839003"), null);
assert.equal(normalizeHealthNumber("a123456789"), "A123456789");
assert.equal(normalizeHealthNumber("123456789"), null);

// Dates: the same day 3 months back, clamped at the end of a shorter month.
assert.equal(monthsBefore("2026-10-26", 3), "2026-07-26");
assert.equal(monthsBefore("2026-05-31", 3), "2026-02-28");

// Section state: empty, partial, full.
const full = {
  ...emptyDetails,
  idNumber: "L01X00T47",
  nationality: "Bulgarian",
  placeOfBirth: "Plovdiv",
  birthDate: "1994-03-12",
  gender: "male",
  idAddress: "ul. Vasil Levski 5, Plovdiv",
  idIssuedOn: "2020-01-10",
  idExpiresOn: "2030-01-10",
};
assert.deepEqual(sectionState(emptyDetails, "idCard", today), { state: "missing", warning: null });
assert.deepEqual(sectionState({ ...emptyDetails, idNumber: "X" }, "idCard", today), { state: "incomplete", warning: null });
assert.deepEqual(sectionState(full, "idCard", today), { state: "complete", warning: null });
assert.equal(sectionState({ ...emptyDetails, licenceClasses: [] }, "licence", today).state, "missing");

// Expiry: within 30 days is soon, day 31 is fine, yesterday is expired, today is still valid but soon.
const expiring = (idExpiresOn) => sectionState({ ...full, idExpiresOn }, "idCard", today).warning;
assert.equal(expiring("2026-11-25"), "expiresSoon");
assert.equal(expiring("2026-11-26"), null);
assert.equal(expiring("2026-10-25"), "expired");
assert.equal(expiring("2026-10-26"), "expiresSoon");

// Führungszeugnis: exactly 3 months old is fine, one day more is too old.
const record = (criminalRecordIssuedOn) =>
  sectionState({ ...emptyDetails, criminalRecordIssuedOn }, "criminalRecord", today).warning;
assert.equal(record("2026-07-26"), null);
assert.equal(record("2026-07-25"), "tooOld");

// Checking a section as typed.
const licence = { licenceNumber: " B072 RRE2I55 ", licenceClasses: ["C1", "B"], licenceIssuedOn: "2015-06-01", licenceExpiresOn: "" };
assert.deepEqual(checkSection("licence", licence, today), {
  ok: true,
  value: { licenceNumber: "B072 RRE2I55", licenceClasses: ["B", "C1"], licenceIssuedOn: "2015-06-01", licenceExpiresOn: null },
});
assert.deepEqual(checkSection("licence", { ...licence, licenceExpiresOn: "2015-06-01" }, today), {
  ok: false,
  problems: { licenceExpiresOn: "beforeIssued" },
});
const idCard = Object.fromEntries(Object.entries(full).filter(([key]) => sectionFields.idCard.includes(key)));
assert.deepEqual(checkSection("idCard", { ...idCard, birthDate: today }, today).problems, { birthDate: "future" });
assert.deepEqual(checkSection("address", { street: "Hauptstr. 1", postcode: "1234", city: "Köln" }, today).problems, {
  postcode: "format",
});
assert.equal(checkSection("address", { street: "Hauptstr. 1", postcode: "12345" }, today), null, "every field is required");
assert.equal(checkSection("tax", { taxId: "12345678901", taxClass: 7 }, today), null, "tax class 7 is a bad request");
assert.equal(checkSection("licence", { ...licence, licenceClasses: ["Z"] }, today), null);

// The request body.
assert.equal(parseDetailsPatch({ section: "bank", values: { bankHolder: "A", iban: "DE89370400440532013000" } }, today).ok, true);
assert.equal(parseDetailsPatch({ section: "bank", values: { bankHolder: "A", iban: "DE00" } }, today).ok, false);
assert.equal(parseDetailsPatch({ section: "bank", values: { bankHolder: "A", iban: null }, userId: "user_x" }, today).ok, false);
assert.equal(parseDetailsPatch({ section: "nope", values: {} }, today).ok, false);
assert.equal(parseDetailsPatch([], today).ok, false);

console.log("Courier document rules: all checks passed.");
