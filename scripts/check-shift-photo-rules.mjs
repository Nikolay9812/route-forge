// Hand-checked rules for shift (vehicle check) photos (prompts/18). Run with
// `node --no-warnings scripts/check-shift-photo-rules.mjs` (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import {
  EXPECTED_SHIFT_PHOTOS,
  isPhotoKey,
  libraryAllowed,
  parseShiftPhotoConfirm,
  parseShiftPhotoQuery,
  parseShiftPhotoRequest,
  shiftPhotoPrefix,
  shiftPhotoSlots,
} from "../src/domain/photos.ts";

// Slots: ten in screen order, eight expected (the two extra bus photos never count).
assert.deepEqual(shiftPhotoSlots, [
  "front",
  "back",
  "left",
  "right",
  "extra1",
  "extra2",
  "logbook",
  "mentor",
  "diesel",
  "adblue",
]);
assert.equal(EXPECTED_SHIFT_PHOTOS.length, 8);
assert.equal(EXPECTED_SHIFT_PHOTOS.includes("extra1"), false);
assert.equal(EXPECTED_SHIFT_PHOTOS.includes("extra2"), false);
assert.equal(libraryAllowed("mentor"), true);
assert.equal(libraryAllowed("front"), false);
assert.equal(libraryAllowed("diesel"), false);

// Requests.
assert.equal(parseShiftPhotoRequest({ slot: "front", contentType: "image/jpeg" }).ok, true);
assert.equal(parseShiftPhotoRequest({ slot: "adblue", contentType: "image/heic" }).ok, true);
assert.equal(parseShiftPhotoRequest({ slot: "idCard", contentType: "image/jpeg" }).ok, false, "no such slot");
assert.equal(parseShiftPhotoRequest({ slot: "constructor", contentType: "image/jpeg" }).ok, false);
assert.equal(parseShiftPhotoRequest({ slot: "front", contentType: "application/pdf" }).ok, false);
assert.equal(parseShiftPhotoRequest({ slot: "front", contentType: "image/jpeg", shiftId: "x" }).ok, false);
assert.equal(parseShiftPhotoRequest(null).ok, false);
assert.equal(parseShiftPhotoRequest(["front"]).ok, false);
assert.equal(parseShiftPhotoConfirm({ slot: "mentor", key: "x" }).ok, true);
assert.equal(parseShiftPhotoConfirm({ slot: "mentor", key: 5 }).ok, false);
assert.equal(parseShiftPhotoConfirm({ slot: "mentor", key: "x", userId: "u" }).ok, false);
assert.equal(parseShiftPhotoQuery(new URLSearchParams("slot=extra2")).ok, true);
assert.equal(parseShiftPhotoQuery(new URLSearchParams("slot=page1")).ok, false);
assert.equal(parseShiftPhotoQuery(new URLSearchParams("")).ok, false);

// Keys: only this firm, courier, shift and slot, plus a UUID.
const uuid = "0b5e3a52-6f1c-4d9e-9a51-2f6a1d0c7e44";
const shiftA = "11111111-1111-4111-8111-111111111111";
const shiftB = "22222222-2222-4222-8222-222222222222";
const prefix = shiftPhotoPrefix("org_1", "user_a", shiftA, "front");
assert.equal(prefix, `firms/org_1/couriers/user_a/shifts/${shiftA}/front/`);
assert.equal(isPhotoKey(prefix + uuid, prefix), true);
assert.equal(isPhotoKey(`firms/org_1/couriers/user_a/shifts/${shiftB}/front/${uuid}`, prefix), false, "another shift");
assert.equal(isPhotoKey(`firms/org_1/couriers/user_c/shifts/${shiftA}/front/${uuid}`, prefix), false, "another courier");
assert.equal(isPhotoKey(`firms/org_1/couriers/user_a/shifts/${shiftA}/back/${uuid}`, prefix), false, "another slot");
assert.equal(isPhotoKey(`${prefix}../../${shiftB}/front/${uuid}`, prefix), false);
assert.equal(isPhotoKey(prefix, prefix), false, "no UUID");
assert.equal(isPhotoKey(`${prefix}${uuid}/x`, prefix), false);

console.log("Shift photo rules: all checks passed.");
