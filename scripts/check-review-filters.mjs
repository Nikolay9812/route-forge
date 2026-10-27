// Hand-checked rules for the Approvals filters (prompts/24). Run with `npm run check:review-filters`
// (Node 23.6+ strips the TypeScript types).
import assert from "node:assert/strict";

import {
  emptyReviewFilters,
  isFiltered,
  parseReviewQuery,
  pruneReviewFilters,
  reviewQuery,
} from "../src/domain/review-filters.ts";

const depot = "0b8c5a2e-1d7f-4e0a-9b3c-2f6d8e1a4c70";
const car = "7e2f9d14-5a3b-4c8e-8f1d-6b0a2c9e3d55";
const user = "user_2abcDEF123";
const parse = (query) => parseReviewQuery(new URLSearchParams(query));

// Defaults and the round trip.
assert.deepEqual(parse(""), { view: "pending", filters: emptyReviewFilters });
assert.equal(reviewQuery("pending", emptyReviewFilters), "view=pending");
const full = { depotId: depot, carId: car, userId: user, missingPhotos: true, corrected: true, status: "rejected", sort: "bus" };
assert.deepEqual(parse(reviewQuery("reviewed", full)), { view: "reviewed", filters: full });
// Pending never sends a status, so a saved Reviewed status doesn't break the Pending list.
assert.ok(!reviewQuery("pending", full).includes("status"));
assert.deepEqual(parse(reviewQuery("pending", full))?.filters, { ...full, status: null });

// Malformed input.
for (const query of [
  "view=all",
  "view=pending&status=approved",
  "view=reviewed&status=submitted",
  "depotId=x",
  `depotId=${depot}x`,
  "carId=",
  "userId=org_123",
  "userId=user_",
  "photos=all",
  "corrected=true",
  "sort=pay",
]) {
  assert.equal(parse(query), null, query);
}

// What counts as filtered: never the sort, status only in Reviewed.
assert.equal(isFiltered({ ...emptyReviewFilters, sort: "courier" }, "pending"), false);
assert.equal(isFiltered({ ...emptyReviewFilters, status: "approved" }, "pending"), false);
assert.equal(isFiltered({ ...emptyReviewFilters, status: "approved" }, "reviewed"), true);
assert.equal(isFiltered({ ...emptyReviewFilters, missingPhotos: true }, "pending"), true);

// Pruning drops IDs that left the lists and keeps the rest.
const options = { depots: [{ id: depot, name: "HBW3" }], couriers: [], buses: [{ id: car, plate: "KH I 6004" }] };
assert.deepEqual(pruneReviewFilters(full, options), { ...full, userId: null });

console.log("review filters: all checks passed");
