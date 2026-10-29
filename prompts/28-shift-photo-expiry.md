# 28 · Vehicle check photos expire after 14 days

Status: done (2026-10-29)

## Goal
Vehicle check (shift) photos are deleted automatically 14 days after they're taken, so the bucket doesn't fill up
with daily photos (about 750 MB a day at 50 couriers). Couriers and reviewers see that a shift's photos were
deleted after 14 days instead of "Missing", and the privacy policy can state the retention.

## Decisions
- **14 days, the same for every firm.** One constant `SHIFT_PHOTO_DAYS = 14` in `src/domain/photos.ts`. Changing it
  later means changing the constant and rerunning the lifecycle script. No firm setting.
- **The clock starts when the photo was kept** (`shift_photos.uploaded_at`, the moment `keepUpload` copies it to its
  key, which is also when R2 creates the final object). A rejected shift fixed later keeps its new photos for 14
  days from then.
- **R2 deletes the files** with a bucket lifecycle rule: objects under `shifts/` are deleted after 14 days. No cron
  job, no new service. R2 runs lifecycle rules about once a day, so a file can outlive its 14 days by up to a day;
  the API hides it at exactly 14 days, so nobody sees it after that.
- **Shift photos move to their own top-level prefix**, because R2 rules match by prefix only and must never reach
  document photos under `firms/`: `shifts/{firmId}/{userId}/{shiftId}/{slot}/{uuid}` (was
  `firms/{firmId}/couriers/{userId}/shifts/{shiftId}/{slot}/{uuid}`). Uploads still stage under `pending/` first.
  Existing dev photos under the old prefix are dropped by the next `db:seed`, and production has none yet.
- **Rows stay.** `shift_photos` rows are kept after expiry (they're tiny), so `photoCount`, the Approvals badge
  ("Photos 8/8") and the "Missing photos" filter keep saying what the courier took. Only the files go.
- **What people see:** an expired photo gets no signed URL. Shift answers that carry `photos` (`GET
  /api/shifts/today`, `GET /api/shifts/:id`, `GET /api/approvals/:id`) also carry `expiredPhotos: ShiftPhotoSlot[]`.
  The read-only Vehicle check card shows those slots as "Deleted" instead of "Missing", counts them in its "8 of 8"
  tag, and adds one footnote under the title: "Photos are deleted 14 days after they're taken." When the courier
  edits a rejected shift, an expired slot is simply empty and can be retaken (replacing deletes the old row; the
  file is already gone, which `deleteObject` accepts).
- **Mechanics** see only the last 7 days, so their garage checks never reach expired photos. `GET
  /api/garage/shifts/:id` still filters by the same rule for safety but needs no note.
- **Privacy text:** the placeholder policy and the delete-account page gain one sentence on the 14 days, in en, bg
  and de. The final legal text is still a separate step of plan 26.

## Out of scope
- A per-firm retention setting, and a cron job.
- Expiry of document photos, talon photos or service log note photos (they stay until replaced or removed).
- Deleting the expired `shift_photos` rows.

## Steps
### 1. Domain: prefix and retention rule
In `src/domain/photos.ts`: `SHIFT_PHOTO_DAYS = 14`, `SHIFT_PHOTO_ROOT = "shifts/"`, `shiftPhotoPrefix` returns
`shifts/{firmId}/{userId}/{shiftId}/{slot}/`, and a pure `shiftPhotoExpired(uploadedAt: Date, now: Date)` (strictly
older than 14 × 24 h). Done: `node --no-warnings scripts/check-shift-photo-rules.mjs` gains cases for the new prefix and the 14-day edge
(exactly 14 days = still shown, one minute more = expired) and passes.

### 2. Server: hide expired photos, answer expiredPhotos
`src/server/shift-photos.ts`: `photosOfShift` selects `uploadedAt` too and signs only live photos; a new
`shiftPhotoState(firmId, shiftId)` answers `{ photos, expiredPhotos }`. `GET /api/shifts/today`, `GET
/api/shifts/:id` and `GET /api/approvals/:id` answer both (types in `src/domain/types.ts`). The photo
POST/PUT/DELETE routes keep answering live `photos` only. The garage check uses `photosOfShift` (live only).
Done: tsc passes.

### 3. App: the card shows deleted photos
`VehicleCheckCard` takes `expired?: ShiftPhotoSlot[]`: read-only slots in it show `shiftPhotos.deleted` as their
empty text, the tag counts them as taken, and a footnote `shiftPhotos.expiredNote` (with `{{days}}`) shows when the
list isn't empty. Pass it from the shift screen, `/shifts/[id]` and the review detail (`src/components/approvals/`).
New strings in en/bg/de. Done: lint and tsc pass.

### 4. Bucket rule, seed and checks
`scripts/r2-lifecycle.mjs` sets two rules: the existing `pending/` one-day rule and `delete-shift-photos` (prefix
`shifts/`, age `SHIFT_PHOTO_DAYS` days, imported from `src/domain/photos.ts`). Run it on the dev bucket.
`scripts/seed.mjs` also deletes `shifts/{firmId}/`. `scripts/check-shift-photos.mjs`: expect the new prefix, and
add an expiry case: set one photo's `uploaded_at` back 15 days with SQL (dev only), then `GET /api/shifts/:id`
and `GET /api/approvals/:id` list that slot in `expiredPhotos` and not in `photos`, and `photoCount` is unchanged.
Update the privacy and delete-account strings (en/bg/de). Done: `db:seed`, then all `check:*` scripts pass.

### 5. Production bucket (with the user)
The user runs the lifecycle script against the production bucket (its env file, as in plan 26 step 9), then
redeploys production (export, then deploy, run separately). Done: the Cloudflare API lists both rules on
`route-forge-documents`.

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `node --no-warnings scripts/check-shift-photo-rules.mjs`, and every dev `check:*` after `db:seed`.
- The lifecycle rules read back from the Cloudflare API on both buckets: `pending/` 1 day, `shifts/` 14 days.
- A new upload's key starts with `shifts/`, and no document photo key does.
- On the phone (preview APK or dev server): a shift with one photo set back 15 days shows "Deleted" on that slot
  and the footnote, in the courier's `/shifts/[id]` and the review detail, and Approvals still shows "Photos n/8".
- The privacy page on preview mentions the 14 days.

## AGENTS.md updates
- Who owns what → Files: shift photo keys are `shifts/{firmId}/{userId}/{shiftId}/{slot}/{uuid}`; the bucket's
  lifecycle rule deletes `shifts/` after 14 days (`SHIFT_PHOTO_DAYS`) and `pending/` after 1 day
  (`npm run r2:lifecycle`, every bucket).
- Domain → Vehicle check photos: deleted 14 days after they're taken; rows stay, so counts and filters are
  unchanged; expired slots show "Deleted" with a note; answers carry `expiredPhotos`.
- Replace the "(postponed)" shift photo expiry mention in plan 26's Decisions with a pointer to this plan.

## Progress (2026-10-29)
Steps 1–4 built on branch `chapter-25-shift-photo-expiry`. The dev bucket has both rules (read back: `pending/`
86400 s, `shifts/` 1209600 s, plus Cloudflare's default multipart abort rule). courier.a ("Anna Courier") and
courier.b ("Ben Courier") were recreated in Clerk dev after the plan 26 account deletion tests, without passwords
(email code). After `db:seed`, every `check:*` passes, including 5 new expiry checks in `check:shift-photos`.
`check:car-papers` needs a fresh seed when run after the others (they move the odometer); that was already so.

## Result
Vehicle check photos are hidden 14 days after they're taken and their files are deleted by the bucket rule, on dev
and production. Seen on the Samsung (dev): a photo aged 15 days showed "Deleted" with the note for the courier and
the dispatcher, beside a live photo, and the count stayed "2 of 8". Production: `route-forge-documents` has both
rules (read back from the Cloudflare API), and the redeployed `/privacy` states the 14 days.
