# 18 · Shift photos (vehicle check)

Status: done

## Goal
On each shift, the courier can add photos: the bus (front, back, left, right, plus 2 extra), the logbook (Fahrtenbuch), the Mentor app score, and the diesel and AdBlue gauges. None of them are required. Dispatchers (in their depots) and owners see the photos on the shift. A badge in the Approvals list shows at a glance who added photos and who didn't.

## Decisions
- **Photos belong to a shift**, not to a bus or a courier. The bus is the one already picked on the shift. If the bus is changed or corrected later, the photos stay.
- **Slots (`ShiftPhotoSlot`)**, in this order:
  - Bus group: `front`, `back`, `left`, `right`, `extra1`, `extra2`.
  - Logbook group: `logbook`.
  - Mentor group: `mentor`.
  - Fuel group: `diesel`, `adblue`.
  - One photo per slot; replacing a photo deletes the old one.
- **Expected photos:** 8, which is every slot except `extra1`/`extra2`. The count and the badge use only those 8, so extras never make a shift look incomplete.
- **Not required:** photos never block finishing, submitting or approving a shift.
- **Sources:** the camera only, except for `mentor`, which offers "Choose from library" (it's an app screenshot) as well as the camera. This stops reuse of an old photo of the bus or gauges.
- **Who can change photos:** the courier, on their own shift, while it is `draft` or `rejected` (the same rule as the fields). Otherwise the API answers `notEditable`. Dispatchers and owners only view; they can't add or remove.
- **Who can see photos:**
  - the courier (own shifts)
  - dispatchers (shifts in their depots, through the existing `inScope`)
  - owners (the whole firm)
  - another firm or an out-of-scope depot answers 404, like the rest of the review routes.
- **Storage:** same bucket and flow as plan 17:
  1. `POST` starts an upload and returns a presigned PUT (5 min, Content-Type signed).
  2. The app uploads straight to R2.
  3. `PUT` confirms the upload: key prefix + UUID check, HEAD, ≤ 10 MB, allowed type.
  4. `DELETE` removes the object and its row.

  Keys are `firms/{firmId}/couriers/{userId}/shifts/{shiftId}/{slot}/{uuid}`, made by the server only. Types are JPEG/PNG/HEIC/WebP, reusing `PHOTO_TYPES` and `PHOTO_MAX_BYTES`.
- **Table `shift_photos`:**
  - Columns: `id`, `firmId`, `shiftId` (fk shifts), `userId` (the courier), `slot`, `objectKey`, `contentType`, `size`, `uploadedBy`, `uploadedAt`.
  - Unique on `(firmId, shiftId, slot)`.
  - Shifts are never deleted, so rows live as long as their shift unless the courier removes or replaces them.
- **`Shift.photoCount`:** the number of filled expected slots (0–8). It comes from a subquery in `selectShifts()`, like `corrected`, so every list gets it for free.
- **Signed URLs only on detail answers:**
  - `GET|PATCH /api/shifts/today`, `GET /api/shifts/:id` and `GET /api/approvals/:id` gain `photos: ShiftPhotos` (`Partial<Record<ShiftPhotoSlot, DocumentPhoto>>`, 1-hour GET URLs).
  - Lists never sign URLs.
- **Badge in the Approvals list (pending and reviewed):** the rows also appear in the Team stack through the same review list. The badge reads:
  - "No photos" (new `muted` tone: `neutral-soft`, no dot) at 0
  - "Photos 5/8" (`muted`) at 1–7
  - "Photos 8/8" (new `done` tone: `success-soft`, no dot) at 8
- **Courier UI:**
  - A "Vehicle check" card on the Shifts tab, in the in-progress phase, after the packages card. It has a header counter ("5 of 8") and an "Optional" hint.
  - Groups: "Bus · {plate}" (2-column grid of 6), "Logbook", "Mentor", "Diesel & AdBlue". Slots are 4:3.
  - The same card appears on `/shifts/[id]`: editable when the shift is rejected, read-only otherwise.
  - Uploads work like document photos: right away, the slot dimmed with a spinner, and on failure the slot goes back to before with an alert.
- **Reviewer UI:**
  - A read-only "Vehicle check" card on the review detail (Approvals and Team), with the same groups and counter.
  - Empty expected slots show "Missing" in `ink-muted`. Empty extra slots are hidden.
  - Tapping a photo opens it full screen (an RN `Modal` with `expo-image`, `contentFit="contain"`, tap or close button to dismiss). No new dependency.
- **Shared slot component:** `PhotoSlot` moves from `src/components/documents/` to `src/components/photo-slot.tsx`. It gains `aspectRatio`, `sources: "both" | "camera"`, `readOnly` and `onView` props, and documents keep their current behavior. Its generic strings move from `documents.photos.*` to `photos.*` (take, choose, remove, denied*, tooLarge, uploadError, uploadOffline, removeError).
- **Web:** upload slots are hidden on web, as for documents. Reviewers can still view photos on web, since a signed GET in an `<img>` needs no CORS.
- **Design:** no design attached. The card reuses `Surface`, `ThemedText` variants, `Tag` and the existing photo slot look, with only existing tokens except the two new Tag tones.
- **Retention:** photos are kept for now. A rough estimate: 50 couriers × 10 photos × about 1.5 MB is about 750 MB a day, roughly $4/month extra R2 per year of history. Cleanup comes later.

## Out of scope
- An R2 lifecycle rule or auto-deleting old shift photos.
- Image resizing beyond the picker's `quality: 0.7` (`expo-image-manipulator` would be a new dependency).
- Pinch-to-zoom in the viewer, damage annotations, reading km or fuel from photos.
- Reviewers adding or removing photos, and push reminders to add them.
- A separate daily "who uploaded" screen (the badge covers it).
- Seeded photos (`db:seed` seeds none and clears the bucket prefix as today).

## Steps

### 1. Domain
- `src/domain/types.ts`:
  - `ShiftPhotoSlot`
  - `ShiftPhotos = Partial<Record<ShiftPhotoSlot, DocumentPhoto>>`
  - `Shift.photoCount: number`
- New `src/domain/shift-photos.ts` (pure, type imports only):
  - `shiftPhotoSlots`, `shiftPhotoGroups` (`bus | logbook | mentor | fuel` → slots), `EXPECTED_SHIFT_PHOTOS` (the 8 slots)
  - `libraryAllowed(slot)` (mentor only)
  - `parseShiftPhotoRequest(body)` → `{ slot, contentType }`
  - `parseShiftPhotoConfirm(body)` → `{ slot, key }`
  - `parseShiftPhotoQuery(params)` → `{ slot }`
  - `shiftPhotoPrefix(firmId, userId, shiftId, slot)`
  - It reuses `PHOTO_TYPES`, `PHOTO_MAX_BYTES` and `isPhotoKey` from `courier-details.ts`.
- `scripts/check-shift-photo-rules.mjs`:
  - the slot list, and that extras aren't expected
  - bad slot, bad type and extra keys are refused
  - prefix checks: another shift's or another courier's prefix, `..`, a missing UUID

Done when that script and `tsc` pass.

### 2. Schema
- `src/db/schema.ts`: `shiftPhotos` as in Decisions.
- `npm run db:push`. If drizzle-kit asks about `pay_rates`, empty it, push, then `db:seed`, as AGENTS.md describes.
- `scripts/seed.mjs`: `delete from shift_photos where firm_id = …` before shifts are deleted (the `firms/{firmId}/` prefix delete already covers the objects).

### 3. Server and routes
- `src/server/shifts.ts`: `photoCount` subquery in `shiftSelect` (count of `shift_photos` rows of this shift whose slot is in the expected 8), and `toShift` passes it on.
- New `src/server/shift-photos.ts`:
  - `photosOfShift(firmId, shiftId)` signs the GET URLs.
  - `startShiftPhoto`, `confirmShiftPhoto` (prefix, HEAD, size/type, upsert, then delete the replaced object) and `removeShiftPhoto`.
  - `shiftPhotoRoute(request, { firmId, userId, shift })` handles POST/PUT/DELETE. It answers `notEditable` unless the shift is `draft` or `rejected`, and answers the updated `ShiftPhotos`.
- New `src/app/api/shifts/[id]/photos+api.ts`: `courierContext`, then `ownShift(courier, id)` (through `mine()`); none → 404. Then `shiftPhotoRoute`.
- Add `photos` to the answers of `GET|PATCH /api/shifts/today` (when a shift exists), `GET /api/shifts/:id` and `GET /api/approvals/:id` (after `shiftInScope`).

### 4. Check script
`scripts/check-shift-photos.mjs` + `npm run check:shift-photos` (dev server, after `db:seed`):
- **Courier happy path:** courier.a starts today's shift and uploads a tiny JPEG to `front`.
  - GET today shows `photos.front`, and its URL returns the same bytes. `photoCount` is 1.
  - Replacing it deletes the old object (HEAD → 404).
  - Adding to `extra1` leaves `photoCount` at 1.
  - DELETE removes the row and the object.
- **Status rules:** a submitted or approved shift → `notEditable`. A rejected seeded shift can take a photo.
- **Isolation:**
  - courier.a on courier.c's shift id → 404
  - confirming a key under another shift's prefix → 400
  - bad slot or type → 400
  - confirm without an upload → 400
- **Reviewers:**
  - the dispatcher sees `photos` on an in-scope shift's detail, gets 404 out of scope, and gets 403 on the courier photo route
  - the owner sees photos on any firm shift
  - the Firm B courier and the Ivanov owner can't cross firms (404)
- **Approvals list:** `photoCount` is present on each item.
- **Clean up:** nothing is left under the test prefixes afterwards.

Done when it and every other `check:*` pass.

### 5. App
- Move `PhotoSlot` to `src/components/photo-slot.tsx` with the new props. Update the documents section form and move the shared strings to `photos.*`.
- `src/shifts/shift-photos.ts`: `useShiftPhotos(shiftId, initial)` with `upload(slot, picked)` (start → `File.upload` binary PUT → confirm → swap in the answer), `remove(slot)` and a per-slot `uploadingUri`. Same failure handling as `useDocuments`.
- `src/components/shifts/vehicle-check-card.tsx`: groups, counter, hint and slots (editable or read-only).
  - It's used in `shifts/index.tsx` (in progress), `shifts/[id].tsx` (editable when rejected) and the review detail (read-only, "Missing" placeholders, extras hidden when empty).
- `src/components/photo-viewer.tsx`: the full-screen `Modal`, with a close `IconButton` and reduced-motion-safe fade.
- `src/components/tag.tsx`: `muted` and `done` tones. `review-list.tsx` shows the photo badge next to the status tag.
- Icon registry: reuse `camera`. Add `close` only if it isn't already there.
- Translations in en, bg and de:
  - `photos.*` (moved strings)
  - `shiftPhotos.title`, `optional`, `count`, `missing`, `groups.{bus,logbook,mentor,fuel}`, `slots.{front,back,left,right,extra1,extra2,logbook,mentor,diesel,adblue}`
  - `review.photos.{none,some}`

### 6. Close out
Verification, `## Result`, `Status: done`, and the AGENTS.md updates below.

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `node --no-warnings scripts/check-shift-photo-rules.mjs`.
- `npm run db:seed`, then `npm run check:shift-photos`, `check:details` (the photo slot move must not break documents), `check:api`, `check:approvals`, `check:calendar`, `check:fleet`, `check:pay` and `check:pay-rates`.
- R2 listing via the API token: no objects left under `firms/` after the checks.
- On the user's Samsung (Metro restarted with `--clear`):
  1. As courier.a, start a shift.
     - The Vehicle check card shows "0 of 8".
     - Take the 4 bus sides and diesel; the counter shows "5 of 8".
     - Mentor offers the library; Front offers the camera only.
     - Replace one photo, then remove one.
     - Airplane mode during an upload: an offline alert, and the slot goes back to before.
  2. Finish and submit. Back in Shifts, the shift detail shows the photos read-only.
  3. As the dispatcher, Approvals shows that row with "Photos 4/8" (or similar). A shift with no photos shows "No photos". The detail shows the photos and "Missing" slots, and tapping a photo opens it full screen.
  4. As the owner, the same from the Team tab.
  5. Reject the shift. As courier.a, the shift detail lets them add the missing photos, then resubmit.
  6. Check documents photos still work (ID card front).
  7. Bulgarian and German strings.

## AGENTS.md updates
- **Data:** add `shift_photos` (one per shift and slot; only the R2 key) to the table list. Under Files, add the shift key shape `firms/{firmId}/couriers/{userId}/shifts/{shiftId}/{slot}/{uuid}`.
- **API:**
  - add `POST|PUT|DELETE /api/shifts/:id/photos` (own `draft`/`rejected` shift; same start/keep/remove flow)
  - note `photos` on the today, own shift and approval detail answers
  - note `photoCount` on every `Shift`
- **Domain → Shift:** add the vehicle check:
  - the 10 slots, and the 8 expected
  - not required
  - camera only except Mentor
  - the courier changes photos only while `draft`/`rejected`, and reviewers only view
  - the Approvals badge
- **Shift form / Profile paragraph:** the shared `PhotoSlot` now lives in `src/components/photo-slot.tsx`, with `photos.*` strings.
- **Who sees what:** courier "own shifts (with photos)"; dispatcher "shifts and their photos in their depots".

## Result
Steps 1–6 are built. Lint, `tsc`, `check-shift-photo-rules.mjs`, `check-details-rules.mjs`, `check-salary.mjs` and `check:shift-photos` (47 checks) pass, as does every other `check:*` script. The bucket is empty afterwards. The on-device pass is left for the user.

Changes from the plan:
- **Photo rules moved to `src/domain/photos.ts`.** Domain files only import types from each other, so `shift-photos.ts` couldn't import `PHOTO_TYPES` from `courier-details.ts`. The document photo rules (`sectionPhotos`, `parsePhoto*`, `photoPrefix`) moved there next to the shift ones, with the same behavior.
- **Shared upload helper.** The start → `File.upload` → keep flow is in `uploadPhoto()` (`src/photos/upload.ts`), used by both `useDocuments` and `useShiftPhotos`.
- **No "Logbook"/"Mentor" group headings.** Those two share one row, and each tile has its name under it. Only "Bus · plate" and "Diesel & AdBlue" have headings.
- **Camera-only slots** open the camera straight away when empty. A filled slot opens the menu (retake / remove).
- **`PATCH /api/shifts/today`** still answers the shift only. Photos change only through the photo route.
- **`check:api` and `check:approvals`** now delete `shift_photos` rows before they delete today's test shifts, because of the foreign key.
