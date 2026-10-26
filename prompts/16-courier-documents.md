# 16 · Courier documents

Status: done

## Goal
Couriers fill in their personal documents under Profile → My documents: ID card, driving licence, registered address in Germany, tax ID, social security, health insurance, criminal record certificate, bank account, and contacts. Owners see and edit every courier's documents under Profile → Couriers, with gaps and expiry warnings. Photos can be taken or picked and previewed, but they are not saved yet.

## Decisions
- **Courier fills, owner sees and edits.** A courier reads and edits only their own documents. An owner reads and edits every courier's documents in the firm. Dispatchers get nothing: every route answers `role` (403). This is personal data, like salaries.
- **Optional.** Missing documents never block shifts. Each section shows its state (Missing / Incomplete / Done), and the owner sees what each courier is missing.
- **No checked state and no change log.** It is just the data. Each row records `updatedBy`/`updatedAt` (last editor) only.
- **Employees.** Tax means the 11-digit Steuer-ID plus tax class (Steuerklasse 1–6), not a Steuernummer.
- **Photos are local only.** `expo-image-picker` (new dependency, already approved, included in Expo Go) takes a photo or picks one from the library. It is previewed in the section's photo slots and kept in memory only, so it is gone after an app restart. A footnote says "Photos aren't saved yet". Nothing is uploaded, and the owner's view has no photo slots. Real storage (a private object storage bucket with signed URLs, with only the key in Postgres) is a later feature.
- **Sections and fields** (all text is trimmed; empty means not set):
  1. **ID card** (`idCard`): photos front + back; document number; nationality; place of birth; date of birth; gender (`female` / `male` / `diverse`); address on the card; issued on; expires on.
  2. **Driving licence** (`licence`): photos front + back; licence number; classes (multi-select chips: AM, A1, A2, A, B, BE, C1, C1E, C, CE); issued on; expires on.
  3. **Registered address** (`address`), the German Anmeldung, which can differ from the ID: photo (one slot); street and number; postcode (5 digits); city.
  4. **Tax ID** (`tax`): Steuer-ID (11 digits, spaces ignored, stored as digits only); tax class 1–6.
  5. **Social security** (`social`): Sozialversicherungsnummer (12 characters: 8 digits, 1 letter, 3 digits; spaces ignored, stored uppercase).
  6. **Health insurance** (`health`): photo (card front); insurer name (free text, e.g. "AOK Bayern"); insurance number (1 letter + 9 digits, stored uppercase).
  7. **Criminal record certificate** (`criminalRecord`), the Führungszeugnis: photo (one slot); issued on.
  8. **Bank account** (`bank`): account holder; IBAN (validated with the mod-97 checksum, stored without spaces, uppercase, shown in groups of 4).
  9. **Contacts** (`contacts`): phone; emergency contact name; emergency contact phone. Phones accept `+`, digits, spaces, `-`, `/`, `(`, `)`, with 6–20 digits.
- **Section state:** `missing` = no field set; `complete` = every field set (photos don't count); otherwise `incomplete`.
- **Warnings** (owner and courier both see them): an ID card or licence `expired` (expires on < firm's today) or `expiresSoon` (within 30 days); a criminal record certificate `tooOld` (issued more than 3 months before today).
- **Date rules:** real calendar days. Date of birth before today. Issued on ≤ today. Expires on after issued on when both are set. Dates are picked with `DateField`.
- **Length limits:** names, insurer, place of birth and nationality up to 80 characters; addresses up to 200; document numbers up to 30.
- **Saving:** each section is a form screen with a Save button (no autosave). Save sends only that section's fields. A failure keeps the typed values on screen (offline → offline `Alert`; `invalid` → field errors from the client-side check, which mirrors the server's).
- **Who is listed for owners:** every `org:courier` member (`firmCouriers`) plus anyone who has a details row, sorted by name.
- **Schema:** one table, `courier_details`, with one row per courier per firm and typed nullable columns. The row is created on first save (upsert).
- **No design attached.** Built from the Depots & cars and Pay rates screens with existing primitives and tokens; new icons are added to the registry.

## Out of scope
- Saving photos (object storage, upload, signed URLs, the owner seeing photos).
- An owner "checked" state, change history, and reminders/push notifications for expiry.
- Blocking shifts on missing documents.
- Work permits/residence titles, Steuernummer (self-employed), documents for dispatchers or owners themselves.
- App-level field encryption (Neon encrypts at rest; noted for later).
- Exports (CSV/PDF) for payroll.

## Design
Every value maps to an existing token.

- **Profile (couriers):** between the header and Sign out, a `footnote` label "My documents", then a `Surface` with one row per section, separated by `Divider`s: section icon (`ink`), title in `body` `ink`, and on the right a `Tag` (`sm`): "Missing" (`neutral`), "Incomplete" (`warning`), a warning tag when present ("Expired" `danger`, "Expires soon" `warning`, "Over 3 months old" `warning`, which wins over Done/Incomplete), or nothing when done with no warning (a `check` icon in `success` instead). Then a `chevron`. Same row style as the Firm rows (`px-4 py-3`, ≥ 44 dp, `secondary-soft` press). The Profile screen becomes a `ScrollView`, since the list is long.
- **Profile (owners):** the Firm `Surface` gets a third row "Couriers" (`team` icon).
- **Couriers screen** (`/profile/couriers`, owners): native header "Couriers", back "Profile". A `Surface` with one row per courier: name in `body` `ink`, and under it in `footnote` `ink-muted` "7 of 9 done". On the right, a `danger` `Tag` "1 expired", or a `warning` `Tag` "2 expiring", or none, then a `chevron`. Empty: "No couriers yet", centred, `ink-muted`.
- **Courier screen** (`/profile/courier?userId=`, owners): native header with the courier's name. The same section list as the courier's own Profile, which opens the section form for that courier.
- **Section form** (`/profile/document?section=&userId=`; `userId` only for owners): native header with the section title. `ScrollView` `bg-canvas` `px-4` `gap-4`, keyboard-aware like the existing forms.
  - **Photo slots** (courier only, for sections with photos): one or two side by side, `rounded-md`, `bg-secondary-soft`, card aspect ratio 1.586, with a `camera` icon and "Front" / "Back" / "Photo" in `footnote`. Tapping one opens a native `Alert` with "Take photo" / "Choose from library" / Cancel (plus "Remove" when filled). A filled slot shows the image (`expo-image` if already a dependency, else RN `Image`) covering the slot. Under the slots, the footnote "Photos aren't saved yet" in `ink-muted`.
  - The section's fields are `TextField`s with labels, `DateField`s, `SegmentedControl`s (gender, tax class 1–6), and `Chip`s for licence classes. Keyboard types: `number-pad` for postcode and Steuer-ID, `phone-pad` for phones, `characters` autocapitalize for IBAN/SV/insurance numbers.
  - A warning `Alert` at the top when the section has a warning ("This ID card expired on 3 Oct", etc.).
  - A `Button` "Save" (`primary`), disabled while unchanged or invalid, loading while saving. On success, go back.
  - Errors show under each field. Offline shows the offline `Alert` and keeps the input.
- **States:** a skeleton while loading, an error `Alert` with Retry, the offline `Alert`, and the empty states. Lists fade up on first load only (house curve, fade only under reduced motion).

## Steps

### 1. Domain: types, parsing, status
- In `src/domain/types.ts`, add:
  - `DetailsSection` (the 9 keys)
  - `Gender = "female" | "male" | "diverse"`
  - `CourierDetails` (every field nullable: `idNumber`, `nationality`, `placeOfBirth`, `birthDate`, `gender`, `idAddress`, `idIssuedOn`, `idExpiresOn`, `licenceNumber`, `licenceClasses: string[]`, `licenceIssuedOn`, `licenceExpiresOn`, `street`, `postcode`, `city`, `taxId`, `taxClass`, `socialNumber`, `healthInsurer`, `healthNumber`, `criminalRecordIssuedOn`, `bankHolder`, `iban`, `phone`, `emergencyName`, `emergencyPhone`)
  - `SectionState = { state: "missing" | "incomplete" | "complete"; warning: "expired" | "expiresSoon" | "tooOld" | null }`
  - `CourierDocuments = { userId; name; today; details: CourierDetails; sections: Record<DetailsSection, SectionState> }`
  - `CourierDocumentsItem = { userId; name; complete: number; expired: number; expiring: number }` (`expiring` counts both `expiresSoon` and `tooOld`)
- Add `src/domain/courier-details.ts` (pure, type imports only):
  - `sectionFields: Record<DetailsSection, (keyof CourierDetails)[]>` and `LICENCE_CLASSES`.
  - Normalisers/validators: `normalizeTaxId` (11 digits), `normalizeSocialNumber`, `normalizeHealthNumber`, `normalizeIban` + `validIban` (mod 97), `validPhone`, `validPostcode`.
  - `parseDetailsPatch(section, body): Parsed<Partial<CourierDetails>>`: only that section's keys, no unknown keys, `null` or `""` clears a field, the rules from Decisions. The date rules need `today`, which is passed in.
  - `sectionState(details, section, today): SectionState` and `documentSummary(details, today)` for the owner list.
- Add `scripts/check-details-rules.mjs` (like `check-salary.mjs`) to hand-check:
  - valid and invalid IBANs (`DE89 3704 0044 0532 0130 00` valid; one digit changed invalid)
  - Steuer-ID, SV and insurance number formats
  - state for an empty, partial and full section
  - `expiresSoon` at today + 30 vs + 31
  - `expired` at yesterday
  - `tooOld` at exactly 3 months vs 3 months + 1 day

Done when `node --no-warnings scripts/check-details-rules.mjs` passes and `tsc` passes.

### 2. Schema and seed
- Add `courierDetails` (`courier_details`) to `src/db/schema.ts`: `id` uuid, `firmId`, `userId` text, the `CourierDetails` columns (dates as `date` string mode, `licenceClasses` `text().array()`, `taxClass` integer, `gender` as a new `gender` pgEnum), `updatedBy` text not null, `updatedAt` timestamptz default now, and `createdAt`. Add a unique index on `(firmId, userId)` and a check that `taxClass` is between 1 and 6.
- Run `npm run db:push` (it only adds a table).
- `scripts/seed.mjs`:
  - **courier.a:** every section complete, ID card expiring in 20 days (`expiresSoon`).
  - **courier.c:** ID card, tax and bank filled, the rest empty; criminal record issued 5 months ago (`tooOld`).
  - **courier.b** (Firm B): contacts only.
  - Use clearly fake values (valid-checksum test IBAN, made-up numbers).

Done when `npm run db:seed` runs.

### 3. Server and API routes
`src/server/courier-details.ts`. Every query filters by `firmId`; parameters only; values are never logged:
- `detailsOf(firmId, userId)` returns the row or an all-null `CourierDetails`.
- `saveDetails(firmId, userId, editorId, patch)` upserts `onConflictDoUpdate` on `(firmId, userId)` and sets `updatedBy`/`updatedAt`.
- `documentsList(firmId, today)` lists `firmCouriers` ∪ row owners with names from `userNames` and `documentSummary`.
- `isFirmCourier(firmId, userId)` checks for a member or an existing row; otherwise `notFound`.

Routes, each `handle` → context → before any work, answering only `{ error: code }`:
- `src/app/api/details+api.ts` (`courierContext`): `GET` → own `CourierDocuments`; `PATCH { section, values }` → the updated `CourierDocuments`.
- `src/app/api/couriers/index+api.ts` (`ownerContext`): `GET` → `{ today, couriers: CourierDocumentsItem[] }`.
- `src/app/api/couriers/[userId]+api.ts` (`ownerContext`): `GET` → that courier's `CourierDocuments`; `PATCH { section, values }` → updated. An unknown user or another firm's user → 404.

Done when `curl` with a courier token reads and saves their own details, and a dispatcher gets 403.

### 4. Check script: `npm run check:details`
Add `scripts/check-details.mjs` with `scripts/lib/api-test.mjs`, and add `check:details` to `package.json` (same flags as `check:fleet`; run `db:seed` first; dev only).
- **Courier:** courier.a GETs their own data (all complete, ID `expiresSoon`), PATCHes `contacts`, reads it back, and clears a field with `null`. courier.a has no way to address courier.c: the route takes no user ID, and a `userId` key in the body → 400.
- **Owner:** the list contains courier.a and courier.c with correct counts and no Firm B user. GET courier.c, PATCH courier.c's `bank`, and check `updated_by` = owner via SQL.
- **Roles:** the dispatcher on all three routes → 403 `role`. Couriers on the `/api/couriers` routes → 403 `role`. An owner on `/api/details` → 403 `role`.
- **Tenant isolation:** the Ivanov owner GET/PATCH of courier.b → 404, and courier.b's row is unchanged.
- **Bad input → 400:** an unknown section; a key from another section; a bad IBAN checksum; a 10-digit Steuer-ID; tax class 7; a future birth date; expires on before issued on; a 6-digit postcode; an unknown licence class; a too-long name; a non-object body.

Done when `npm run check:details` passes along with the existing `check:*` scripts.

### 5. Dependency, icons, translations
- `npx expo install expo-image-picker`. Add its config plugin in `app.json` with `photosPermission` and `cameraPermission` texts (English; native builds aren't used yet, Expo Go shows its own).
- Add these icons to `src/components/icons.ts`:
  - `id-card`: `person.text.rectangle` / `badge`
  - `licence`: `car` / `directions_car`
  - `tax`: `percent` / `percent`
  - `social`: `person.badge.shield.checkmark` / `verified_user`
  - `health`: `cross.case` / `medical_services`
  - `record`: `checkmark.seal` / `gavel`
  - `bank`: `building.columns` / `account_balance`
  - `phone`: `phone` / `call`
  - `camera`: `camera` / `photo_camera`

  The address section uses the existing `pin`.
- Add a `documents` block (section titles, field labels, hints, errors, states, warnings, photo strings, Couriers screen) to `en.json`, `bg.json` and `de.json`. German field labels use the official terms (Steuer-ID, Steuerklasse, Sozialversicherungsnummer, Führungszeugnis, Meldeadresse).

Done when `tsc` and lint pass.

### 6. Courier UI
- `src/documents/documents.tsx`: a `DocumentsProvider` wrapping the Profile stack, with the same shape as `PayRatesProvider`. It loads `/api/details` for couriers, or `/api/couriers/:userId` via a `userId` argument. It has `save(section, values)` and holds the local photo map `{ [section]: { front?: uri; back?: uri } }` in state (memory only).
- `src/components/documents/`:
  - `section-rows.tsx`: the section list with state tags; used by Profile and the owner's courier screen
  - `photo-slot.tsx`: the picker `Alert` and preview; asks camera/library permission with the image-picker hooks and shows an `Alert` when denied
  - `section-form.tsx`: renders a section's fields from a field config, runs the client-side check with the domain parser, and handles save/errors
- Routes: `src/app/(app)/profile/document.tsx`, registered in the Profile `_layout.tsx` (title from the section).
- Profile `index.tsx`: a `ScrollView`, plus the "My documents" block for couriers.

Done when, on the user's phone, a courier fills every section, sees the states change, picks and previews photos, and saving offline keeps the input.

### 7. Owner UI
- `src/app/(app)/profile/couriers.tsx` (list, data from a `useCouriers()` hook in `src/documents/`), `src/app/(app)/profile/courier.tsx` (section rows for one courier), and the shared `document.tsx` with `userId` (no photo slots).
- Profile `index.tsx`: a "Couriers" row in the Firm `Surface`.

Done when the owner sees courier.a's expiring ID tag, courier.c's gaps and "Over 3 months old" tag, edits courier.c's bank account, and the list updates.

## Verification
- `npx tsc --noEmit` and `npx expo lint` pass.
- `node --no-warnings scripts/check-details-rules.mjs` passes.
- `npm run db:seed`, then `npm run check:details`, `check:api`, `check:approvals`, `check:calendar`, `check:fleet`, `check:pay`, `check:pay-rates` all pass.
- On the user's Samsung (they reload Metro with `--clear`):
  - as courier.a: Profile shows 9 sections with ID "Expires soon"; edit contacts and save; enter a bad IBAN → error under the field, Save disabled; take/pick ID photos and preview them; airplane mode + Save → offline alert, input kept
  - as courier.c: gaps and the "Over 3 months old" tag
  - as owner: Couriers list counts; open courier.c and fix the bank account
  - as dispatcher: no documents block, no Couriers row
- Bulgarian and German: switch the device language and check the labels fit.

## AGENTS.md updates
- **Data:** add the `courier_details` table (one row per courier per firm, typed columns).
- **API:** add `GET|PATCH /api/details` (courier, own) and `GET /api/couriers`, `GET|PATCH /api/couriers/:userId` (owner; dispatchers `role`).
- **Profile** paragraph: My documents (couriers) and Couriers (owners), `src/documents/`, `src/components/documents/`; photos local-only via `expo-image-picker` until storage exists.
- **Domain:** add "Courier documents" with the sections, the state and warning rules (30 days, 3 months), and the access rules (courier own, owner all, dispatcher none).
- **Who sees what** table: the owner row gains "courier documents"; the courier row gains "own documents".
- **Commands:** `npm run check:details`.

## Result
Built steps 1–7. Lint, `tsc`, `check-details-rules.mjs`, `check-salary.mjs`, `check:details` and every other `check:*` script pass. The on-device pass is left for the user.

Changes from the plan:
- **Sections are saved whole.** A PATCH must carry every field of its section (`""`/`null`/`[]` clears one), which keeps cross-field checks (expires after issued) simple.
- **Save is disabled only while nothing changed.** Pressing it with problems shows them under the fields plus a "Check the highlighted fields" alert, rather than a disabled button with no reason given.
- **No warning color token exists**, so tags use existing tones: Missing `draft`, Incomplete `info`, Expires soon / Over 3 months old `highlight` (primary-soft), Expired `rejected`, Done a `success` check icon. The in-form warning uses the `danger` `Alert` (Alert has no warning tone).
- **Dates that may be unset** use a new `OptionalDateField` ("Add date", then the native picker with a clear button), since `DateField` always needs a value.
- `useFormat` gained `fullDay` ("12 Mar 1994").
- `db:push` stopped on drizzle-kit re-detecting `pay_rates`' `NULLS NOT DISTINCT` unique. Fixed by emptying `pay_rates`, pushing, then re-seeding (now noted in AGENTS.md).
