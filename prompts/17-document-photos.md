# 17 · Document photos and expiry countdown

Status: done

## Goal
Photos of a courier's documents (ID card, licence, address, tax, health card, Führungszeugnis) are saved for good in a private Cloudflare R2 bucket. Couriers see their own, and owners see and manage every courier's. The ID card and driving licence show how long they stay valid ("Valid for 2 years, 3 months, 5 days" / "Expired 4 months, 2 days ago"), both in the form and in the section list.

## Decisions
- **Storage:** one private R2 bucket per environment. Dev is `route-forge-documents-dev` (EEUR, already created, `r2.dev` public access off). Production gets its own bucket later. Nothing in R2 is ever public, and there are no custom domains.
- **Who:** the courier's own photos through `/api/details/photos`. The owner works on any courier of the firm through `/api/couriers/:userId/photos` and can view, add, replace and remove photos, the same as the fields. Dispatchers get `role` (403) and couriers on owner routes get `role`. Another firm's courier → 404.
- **Upload path (chosen):** direct to R2 with a signed URL.
  1. The app sends `POST …/photos { section, slot, contentType }`. The API checks the session, the role and the courier, then answers `{ key, uploadUrl }`, a presigned `PUT` valid for 5 minutes, with the `Content-Type` signed in.
  2. The app uploads the file straight to R2.
  3. The app sends `PUT …/photos { section, slot, key }`. The API checks that the key belongs to this firm, courier, section and slot, then `HEAD`s the object to make sure it exists and is ≤ 10 MB (if not: deletes it and answers `invalid`). It upserts the row, deletes the replaced object, and answers the updated `CourierDocuments`.
- **Remove:** `DELETE …/photos?section=&slot=` deletes the object and the row (photos aren't salary history, and keeping personal data we don't need is worse). It answers the updated `CourierDocuments`.
- **Viewing:** `CourierDocuments` gains `photos: { [section]: { [slot]: { key, url } } }`. The `url` is a presigned `GET` valid for 1 hour, made on every documents read. `expo-image` caches with `cacheKey: key`, so a new signature doesn't download the photo again.
- **Keys:** `firms/{firmId}/couriers/{userId}/{section}/{slot}/{uuid}`, made only by the server. The firm and courier always come from the session or the checked `userId`, never from the body. The confirm step re-derives the prefix and requires a UUID tail.
- **Allowed types:** `image/jpeg`, `image/png`, `image/heic`, `image/webp`. Picker quality stays 0.7. Max 10 MB.
- **Slots per section:** unchanged (`sectionPhotos` in `src/components/documents/fields.ts`): idCard front+back, licence front+back, address photo, tax photo, health front, criminalRecord page1–3. The server keeps the same map in the domain so it can validate it.
- **Photos save right away**, separately from the fields' Save button. The slot shows the picked image dimmed with a spinner while uploading. On failure the slot goes back to what it showed before and an alert appears (offline → offline wording). "Photos aren't saved yet" becomes "Photos are saved as soon as you add them."
- **Section state:** photos still don't count towards Missing/Incomplete/Done.
- **Signing (chosen):** `aws4fetch` (new dependency, server-only, no native code), with `service: "s3"`, `region: "auto"`. Signing, HEAD and DELETE all go through it in `src/server/storage.ts`.
- **Upload on the phone:** `expo-file-system` (new dependency, an Expo module included in Expo Go), `new File(uri).upload(uploadUrl, { httpMethod: "PUT", uploadType: UploadType.BINARY_CONTENT, mimeType })`. A non-2xx status counts as a failure.
- **Env (server only, never `EXPO_PUBLIC_`):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`. `CLOUDFLARE_API_TOKEN` is used only by local scripts and the agent to manage buckets, never by API routes. All are already in `.env.local` and named in `.env.example`.
- **Expiry countdown (chosen: form + section row):** a pure `timeUntil(today, day)` in `src/domain/dates.ts` gives whole calendar `{ years, months, days }` plus `past`. It shows every non-zero unit: "Valid for 1 year, 2 days", "Expires today", "Expired 3 months, 1 day ago".
  - **Form:** a `footnote` under the "Expires on" field of ID card and licence. `ink-muted`, `danger` when expired.
  - **Section rows:** a second line under the "ID card" / "Driving licence" title, in `footnote`, with the same colours. It shows only when an expiry date is set, for couriers and owners alike.
  - Plurals use i18n-js `one`/`other` keys in en, bg and de.
- **Seed:** `db:seed` empties `document_photos` and deletes every object under `firms/` in the dev bucket, so each seed starts clean. No photos are seeded.

## Out of scope
- Photos on web (it would need a bucket CORS rule). Slots stay hidden on web.
- A production bucket and EAS Hosting env vars (next deploy work).
- An R2 lifecycle rule for uploads that never get confirmed (a failed confirm leaves an orphan object in dev; noted for later).
- Image resizing/compression beyond picker quality, multi-page PDFs, OCR of dates from photos.
- Expiry push reminders.

## Steps

### 1. Domain
- `src/domain/types.ts`:
  - move `PhotoSlot` here
  - add `DocumentPhoto = { key: string; url: string }`
  - `CourierDocuments.photos: Partial<Record<DetailsSection, Partial<Record<PhotoSlot, DocumentPhoto>>>>`
  - `ApiErrorCode` unchanged (reuse `invalid`, `notFound`, `role`)
- `src/domain/courier-details.ts`:
  - `sectionPhotos` (moved from `fields.ts`)
  - `PHOTO_TYPES`, `PHOTO_MAX_BYTES = 10 * 1024 * 1024`
  - `parsePhotoRequest(body)` → `{ section, slot, contentType }`
  - `parsePhotoConfirm(body)` → `{ section, slot, key }`
  - `photoPrefix(firmId, userId, section, slot)`
  - `isPhotoKey(key, prefix)` (prefix + UUID)
- `src/domain/dates.ts`: `timeUntil(today, day)`.
- Extend `scripts/check-details-rules.mjs` to cover:
  - slot validity per section (`social` has none, `tax` has only `photo`)
  - type and key checks (another courier's prefix, `..`, a missing UUID)
  - `timeUntil`: today → 0; +1 year +2 days; 31 Jan → 28 Feb; past dates; leap days

Done when the rules script and `tsc` pass.

### 2. Schema, env, storage helper
- `src/db/schema.ts`: table `document_photos` with these columns:
  - `id` uuid
  - `firmId`, `userId`, `section` text, `slot` text, `objectKey` text, `contentType` text
  - `size` integer
  - `uploadedBy` text
  - `uploadedAt` timestamptz default now

  Add a unique index on `(firmId, userId, section, slot)`, then run `npm run db:push`. It only adds a table, but if drizzle-kit asks about `pay_rates` again, empty it, push, and re-seed, as AGENTS.md describes.
- `npx expo install aws4fetch expo-file-system`.
- `src/server/storage.ts` (server only):
  - `presignPut(key, contentType)` (300 s) and `presignGet(key)` (3600 s): set `X-Amz-Expires` on the URL, then `sign(..., { aws: { signQuery: true } })`
  - `headObject(key)` → size or null
  - `deleteObject(key)`
  - `deletePrefix(prefix)` (ListObjectsV2 + delete, for the seed)

  It reads env lazily and never logs keys or URLs.
- `.env.example` already has the names. Check there is no `EXPO_PUBLIC_` R2 variable.

Done when a scratch Node call to `storage.ts` (via `scripts/`) puts a small file through a presigned URL, HEADs it, GETs it through a signed URL and deletes it.

### 3. Server and API routes
- `src/server/courier-details.ts`:
  - `photosOf(firmId, userId)` builds signed URLs
  - `documentsOf` includes `photos`
  - `startPhoto` (key + upload URL)
  - `confirmPhoto` (prefix check, HEAD, size/type check, upsert in one statement, then delete the old object)
  - `removePhoto`
- Routes, each `handle` → context → checks before any work, answering only `{ error }`:
  - `src/app/api/details/photos+api.ts` (`courierContext`): `POST`, `PUT`, `DELETE`.
  - Move `src/app/api/couriers/[userId]+api.ts` to `src/app/api/couriers/[userId]/index+api.ts` (unchanged), then add `src/app/api/couriers/[userId]/photos+api.ts` (`ownerContext` + `isFirmCourier`).
- `scripts/seed.mjs`: empty `document_photos`, then `deletePrefix("firms/")`.

### 4. Check script
Extend `scripts/check-details.mjs` (it already runs against the dev server after `db:seed`):
- **Courier happy path:** courier.a starts an ID front upload, PUTs a tiny JPEG to the URL, and confirms. GET shows `photos.idCard.front.url`, which fetches the same bytes. Replacing it deletes the old object (HEAD → 404). DELETE removes the row and the object.
- **Courier can't reach others:** courier.a confirms a key under courier.c's prefix → 400. A slot that doesn't exist (`social/front`) → 400. A bad content type → 400. Confirm without upload → 400. Uploading with a different `Content-Type` than signed → R2 403.
- **Owner:** uploads, sees and removes a courier.c photo. `uploaded_by` = the owner (SQL).
- **Roles:** the dispatcher on all photo routes → 403. Couriers on owner photo routes → 403.
- **Tenant isolation:** the Ivanov owner on courier.b's photos → 404, and Firm B's objects are untouched.

Done when `npm run check:details` and every other `check:*` pass.

### 5. App
- `src/documents/documents.tsx`:
  - Remove the in-memory photo map.
  - Add `uploadPhoto(userId, section, slot, asset)` (start → `File.upload` → confirm → swap in the answer) and `removePhoto`.
  - Keep a per-slot `uploading` uri for the dimmed preview.
- `photo-slot.tsx`:
  - Shows `photo.url` with `cacheKey: photo.key`, or the local uri while uploading (dimmed, `ActivityIndicator`).
  - Passes the picked asset's `mimeType` (default `image/jpeg`).
  - Shows an alert on failure (offline/other).
- `section-form.tsx`: slots for couriers and owners alike, native only (`Platform.OS !== "web"`), with the new footnote.
- Countdown:
  - `src/components/documents/expiry-line.tsx` renders `timeUntil`.
  - Use it under the expiry field in `section-form.tsx`, and as the second line in `section-rows.tsx` for idCard/licence (rows grow to two lines; min height stays ≥ 44).
- Translations in en, bg and de:
  - `documents.photos.saved`, `uploadError`, `uploadOffline`, `removeError`
  - `documents.expiry.valid`, `today`, `expired`
  - `documents.units.{years,months,days}` with `one`/`other`

### 6. AGENTS.md and close out
See below.

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `node --no-warnings scripts/check-details-rules.mjs`.
- `npm run db:seed`, then `npm run check:details` plus `check:api`, `check:approvals`, `check:calendar`, `check:fleet`, `check:pay`, `check:pay-rates`.
- R2 bucket listing via the API token after the checks: no objects left under `firms/`.
- On the user's Samsung (Metro restarted with `--clear`):
  - as courier.a: the ID card row shows "Valid for 20 days". Open the ID card, take a front photo (spinner, then the photo stays), close and reopen the app, and the photo is still there. Replace it, then remove it.
  - Airplane mode while adding a photo → offline alert, and the slot goes back to before.
  - as owner: Couriers → courier.a → ID card shows the courier's photo. Add a licence photo for courier.c.
  - as dispatcher: no documents anywhere.
  - Bulgarian and German: the countdown wording and plurals.

## AGENTS.md updates
- **Who owns what → Data:** add "Files (document photos) live in a private Cloudflare R2 bucket per environment (dev `route-forge-documents-dev`). Only API routes reach it, through `src/server/storage.ts` (`aws4fetch`, `R2_*` env). Postgres keeps only the object key (`document_photos`). The app uploads with short-lived presigned PUT URLs and shows photos through 1-hour presigned GET URLs. Nothing is public. `CLOUDFLARE_API_TOKEN` is for local scripts and bucket management only." Add `document_photos` to the table list.
- **API:** add `POST|PUT|DELETE /api/details/photos` and `/api/couriers/:userId/photos`.
- **Profile paragraph:** replace "Document photos are picked with `expo-image-picker` and kept in memory only … owners see no photo slots" with the new rule: photos are uploaded right away with `expo-file-system`, owners see and manage them, and there are no slots on web. Add the expiry countdown.
- **Domain → Courier documents:** add the photo slots per section, the 10 MB limit and types, that removing deletes the object, and the countdown.
- **Who sees what:** unchanged (courier documents already includes photos).
- **Rules:** add "Personal files never go to a public bucket or URL. Signed URLs are short-lived and never logged."

## Result
Built steps 1–6. Lint, `tsc`, `check-details-rules.mjs`, `check-salary.mjs`, `check:details` (76 checks, 34 of them new photo checks) and every other `check:*` script pass, and the bucket is empty after the checks. The on-device pass is left for the user.

Changes from the plan:
- **No route move.** `src/app/api/couriers/[userId]+api.ts` stays where it is. Expo Router serves it next to the new `[userId]/photos+api.ts` folder, as `shifts/[id]` already does.
- **One shared handler.** `photoRoute()` in `src/server/courier-details.ts` serves both photo routes. The routes only pick the context (the courier themselves, or the owner plus `isFirmCourier`).
- **Content-Type is signed with `allHeaders: true`.** aws4fetch leaves Content-Type out of the signature by default. With it signed, R2 answers 403 to an upload of another type (checked).
- **Seed** deletes `firms/{firmId}/` per seeded firm instead of all of `firms/`.
- **Client-side 10 MB check** before uploading (an alert), on top of the server's HEAD check.
- **German countdown** uses dative phrasing ("Läuft in 2 Jahren ab", "Vor 3 Monaten abgelaufen") so the plural units fit both sentences.
- `db:push` stopped on the known `pay_rates` prompt. Emptied `pay_rates`, pushed, then re-seeded.
