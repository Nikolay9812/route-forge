// Hand-checked rules for the owner's People screen (prompts/21). Run with `npm run check:people-rules`
// (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import { MAX_EMAIL, normalizeEmail, parseInvite, parsePersonPatch, validEmail } from "../src/domain/people.ts";

// Emails: trimmed and lowercased, a simple local@domain.tld shape, at most 254 characters.
assert.equal(validEmail("  Anna.Petrova+clerk_test@Example.COM "), "anna.petrova+clerk_test@example.com");
assert.equal(normalizeEmail(" A@B.DE "), "a@b.de");
assert.equal(validEmail("a@b.co.uk"), "a@b.co.uk");
for (const bad of ["", "anna", "anna@", "@example.com", "anna@example", "an na@example.com", "a@@b.de", "a@b..de", "a@.de"])
  assert.equal(validEmail(bad), null, JSON.stringify(bad));
assert.equal(validEmail(42), null);
assert.equal(validEmail(null), null);
const long = `${"a".repeat(MAX_EMAIL - "@example.com".length)}@example.com`;
assert.equal(validEmail(long), long, "exactly 254");
assert.equal(validEmail(`a${long}`), null, "255 is too long");

// Invite: exactly { email, role }, and only courier or dispatcher.
assert.deepEqual(parseInvite({ email: " X@Y.DE ", role: "courier" }), { ok: true, value: { email: "x@y.de", role: "courier" } });
assert.deepEqual(parseInvite({ email: "x@y.de", role: "dispatcher" }), {
  ok: true,
  value: { email: "x@y.de", role: "dispatcher" },
});
for (const role of ["owner", "org:owner", "org:courier", "admin", "", null, undefined])
  assert.deepEqual(parseInvite({ email: "x@y.de", role }), { ok: false }, `role ${role}`);
assert.deepEqual(parseInvite({ email: "nope", role: "courier" }), { ok: false });
assert.deepEqual(parseInvite({ email: "x@y.de" }), { ok: false }, "role missing");
assert.deepEqual(parseInvite({ email: "x@y.de", role: "courier", firmId: "org_1" }), { ok: false }, "extra key");
assert.deepEqual(parseInvite(null), { ok: false });
assert.deepEqual(parseInvite([]), { ok: false });

// Member patch: exactly one of { role } or { depotIds }.
assert.deepEqual(parsePersonPatch({ role: "dispatcher" }), { ok: true, value: { role: "dispatcher" } });
assert.deepEqual(parsePersonPatch({ role: "owner" }), { ok: false });
const d1 = "6F1C2A4E-1B2C-4D3E-8F90-1234567890AB";
const d2 = "0b0e7a6c-5d4e-4f3a-9b2c-abcdefabcdef";
assert.deepEqual(parsePersonPatch({ depotIds: [d1, d2] }), { ok: true, value: { depotIds: [d1.toLowerCase(), d2] } });
assert.deepEqual(parsePersonPatch({ depotIds: [] }), { ok: true, value: { depotIds: [] } }, "no depots is allowed");
assert.deepEqual(parsePersonPatch({ depotIds: [d1, d1.toLowerCase()] }), { ok: false }, "duplicates");
assert.deepEqual(parsePersonPatch({ depotIds: ["depot-1"] }), { ok: false }, "not a UUID");
assert.deepEqual(parsePersonPatch({ depotIds: d1 }), { ok: false }, "not an array");
assert.deepEqual(parsePersonPatch({ depotIds: Array.from({ length: 101 }, () => d1) }), { ok: false }, "too many");
assert.deepEqual(parsePersonPatch({ role: "courier", depotIds: [] }), { ok: false }, "both keys");
assert.deepEqual(parsePersonPatch({}), { ok: false }, "neither key");
assert.deepEqual(parsePersonPatch(null), { ok: false });

console.log("People rules ✅");
