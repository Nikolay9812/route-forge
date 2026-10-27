// Hand-checked rules for the service log and the mechanic's 7 days of vehicle checks (prompts/23). Run with
// `npm run check:car-note-rules` (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import {
  addDays,
  canEditNote,
  earliestNoteDay,
  garageFrom,
  MAX_NOTE_KM,
  MAX_NOTE_TEXT,
  noteCursor,
  parseCarNote,
  parseCarNoteCreate,
  parseCursor,
  parseNoteFilter,
} from "../src/domain/car-notes.ts";
import { assignableRoles, parseInvite } from "../src/domain/people.ts";
import {
  carNotePhotoPrefix,
  isPhotoKey,
  parseCarNotePhotoConfirm,
  parseCarNotePhotoQuery,
  parseCarNotePhotoRequest,
} from "../src/domain/photos.ts";

const today = "2026-10-27";
const note = (patch = {}) => ({ type: "oil", doneOn: today, km: 58000, text: "Oil and filter", ...patch });

// Days: across months, years and leap days.
assert.equal(addDays("2026-03-01", -1), "2026-02-28");
assert.equal(addDays("2028-03-01", -1), "2028-02-29");
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(garageFrom(today), "2026-10-21", "today and the six days before");
assert.equal(garageFrom("2026-03-03"), "2026-02-25");
assert.equal(earliestNoteDay(today), "2025-10-27");

// A note: exactly { type, doneOn, km, text }.
assert.deepEqual(parseCarNote(note(), today), { ok: true, value: note() });
assert.deepEqual(parseCarNote(note({ text: "  Pads  " }), today).value.text, "Pads", "trimmed");
assert.deepEqual(parseCarNote(note({ text: "   " }), today).value.text, null, "blank text is none");
assert.deepEqual(parseCarNote(note({ text: null, km: null }), today), {
  ok: true,
  value: { type: "oil", doneOn: today, km: null, text: null },
});
for (const type of ["tyres", "oil", "brakes", "inspection", "repair"]) assert.equal(parseCarNote(note({ type, text: null }), today).ok, true, type);
assert.equal(parseCarNote(note({ type: "other", text: null }), today).ok, false, "other needs text");
assert.equal(parseCarNote(note({ type: "other", text: " " }), today).ok, false, "other needs real text");
assert.equal(parseCarNote(note({ type: "other", text: "Wipers" }), today).ok, true);
for (const type of ["Oil", "wheels", "", null, "constructor"]) assert.equal(parseCarNote(note({ type }), today).ok, false, `type ${type}`);

// Dates: today back to a year ago, real days only.
assert.equal(parseCarNote(note({ doneOn: addDays(today, 1) }), today).ok, false, "tomorrow");
assert.equal(parseCarNote(note({ doneOn: "2025-10-27" }), today).ok, true, "exactly a year back");
assert.equal(parseCarNote(note({ doneOn: "2025-10-26" }), today).ok, false, "more than a year back");
for (const doneOn of ["2026-02-30", "2026-13-01", "27.10.2026", "2026-10-27T10:00", "", null, 20261027])
  assert.equal(parseCarNote(note({ doneOn }), today).ok, false, `doneOn ${doneOn}`);

// Km: whole numbers 0 … 2,000,000, or null.
assert.equal(parseCarNote(note({ km: 0 }), today).ok, true);
assert.equal(parseCarNote(note({ km: MAX_NOTE_KM }), today).ok, true);
for (const km of [-1, MAX_NOTE_KM + 1, 1.5, "58000", NaN, Infinity])
  assert.equal(parseCarNote(note({ km }), today).ok, false, `km ${km}`);

// Text: up to 1,000 characters after trimming.
assert.equal(parseCarNote(note({ text: "a".repeat(MAX_NOTE_TEXT) }), today).ok, true);
assert.equal(parseCarNote(note({ text: "a".repeat(MAX_NOTE_TEXT + 1) }), today).ok, false);
assert.equal(parseCarNote(note({ text: 42 }), today).ok, false);

// Shape: no missing or extra keys.
const { km: _km, ...noKm } = note();
assert.equal(parseCarNote(noKm, today).ok, false, "km must be sent, even as null");
assert.equal(parseCarNote({ ...note(), createdBy: "user_1" }, today).ok, false, "extra key");
assert.equal(parseCarNote(null, today).ok, false);
assert.equal(parseCarNote([], today).ok, false);

// Create: the note plus a car UUID.
const car = "6F1C2A4E-1B2C-4D3E-8F90-1234567890AB";
assert.deepEqual(parseCarNoteCreate({ carId: car, ...note() }, today), { ok: true, value: { ...note(), carId: car.toLowerCase() } });
assert.equal(parseCarNoteCreate({ carId: "car-1", ...note() }, today).ok, false);
assert.equal(parseCarNoteCreate(note(), today).ok, false, "no car");
assert.equal(parseCarNoteCreate({ carId: car, ...note({ type: "other", text: null }) }, today).ok, false);

// Editing: the author only, for 7 days from writing it.
const written = { createdBy: "user_m", createdAt: "2026-10-20T10:00:00.000Z" };
assert.equal(canEditNote(written, "user_m", new Date("2026-10-27T09:59:59.999Z")), true, "just inside 7 days");
assert.equal(canEditNote(written, "user_m", new Date("2026-10-27T10:00:00.000Z")), false, "7 days are over");
assert.equal(canEditNote(written, "user_owner", new Date("2026-10-21T10:00:00.000Z")), false, "not the author");

// Service log filter and cursor.
const id = "0b0e7a6c-5d4e-4f3a-9b2c-abcdefabcdef";
const cursor = noteCursor({ doneOn: "2026-10-01", createdAt: "2026-10-02T15:00:00.000Z", id });
assert.deepEqual(parseCursor(cursor), { doneOn: "2026-10-01", createdAt: "2026-10-02T15:00:00.000Z", id });
for (const bad of ["", "2026-10-01", `2026-10-01|nope|${id}`, `2026-10-01|2026-10-02T15:00:00.000Z|x`, `${cursor}|x`])
  assert.equal(parseCursor(bad), null, bad);
assert.deepEqual(parseNoteFilter(new URLSearchParams("")), { ok: true, value: { carId: null, type: null, before: null } });
assert.deepEqual(parseNoteFilter(new URLSearchParams(`carId=${car}&type=tyres&before=${encodeURIComponent(cursor)}`)), {
  ok: true,
  value: { carId: car.toLowerCase(), type: "tyres", before: cursor },
});
assert.equal(parseNoteFilter(new URLSearchParams("type=wheels")).ok, false);
assert.equal(parseNoteFilter(new URLSearchParams("carId=1")).ok, false);
assert.equal(parseNoteFilter(new URLSearchParams("before=yesterday")).ok, false);

// Note photos: three slots, the usual file types, keys under the note's prefix.
assert.deepEqual(parseCarNotePhotoRequest({ slot: "photo1", contentType: "image/jpeg" }), {
  ok: true,
  value: { slot: "photo1", contentType: "image/jpeg" },
});
assert.equal(parseCarNotePhotoRequest({ slot: "photo4", contentType: "image/jpeg" }).ok, false);
assert.equal(parseCarNotePhotoRequest({ slot: "talon", contentType: "image/jpeg" }).ok, false);
assert.equal(parseCarNotePhotoRequest({ slot: "photo1", contentType: "application/pdf" }).ok, false);
assert.equal(parseCarNotePhotoConfirm({ slot: "photo3", key: "k" }).ok, true);
assert.equal(parseCarNotePhotoConfirm({ slot: "photo3", key: "k", extra: 1 }).ok, false);
assert.deepEqual(parseCarNotePhotoQuery(new URLSearchParams("slot=photo2")), { ok: true, value: { slot: "photo2" } });
assert.equal(parseCarNotePhotoQuery(new URLSearchParams("slot=front")).ok, false);
const prefix = carNotePhotoPrefix("org_1", car, id, "photo1");
assert.equal(prefix, `firms/org_1/cars/${car}/notes/${id}/photo1/`);
assert.equal(isPhotoKey(`${prefix}${id}`, prefix), true);
assert.equal(isPhotoKey(`firms/org_1/cars/${car}/talon/${id}`, prefix), false, "the talon isn't a note photo");

// Owners can now invite mechanics, still never owners.
assert.deepEqual([...assignableRoles], ["courier", "dispatcher", "mechanic"]);
assert.deepEqual(parseInvite({ email: "m@y.de", role: "mechanic" }), { ok: true, value: { email: "m@y.de", role: "mechanic" } });
assert.equal(parseInvite({ email: "m@y.de", role: "org:mechanic" }).ok, false);

console.log("All car note rules hold.");
