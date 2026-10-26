# 19 · Car papers and VIN

Status: done

## Goal
The owner keeps each car's papers in Depots & cars: its VIN, one photo of the registration certificate ("small talon", Zulassungsbescheinigung Teil I), and the TÜV (HU), insurance and next service dates, with warnings when one runs out. A courier sees the VIN of the car on their shift as a QR code they can scan, plus a Copy button.

## Decisions
- **VIN is text, the QR is generated.** The owner types the VIN (e.g. `ZFA250006SMC06228`); the app draws the QR from it with `react-native-qrcode-svg` (needs `react-native-svg`). Copy uses `expo-clipboard`. All three run in Expo Go and on web. The user approved these dependencies by picking this option.
- VIN rule (`validVin` in `src/domain/fleet.ts`): spaces removed, uppercase, exactly 17 of `A–H J–N P R–Z 0–9` (no I, O, Q), no check digit (EU VINs don't use one). Optional (null = not set). Unique per firm when set (`taken`). The QR encodes exactly the stored VIN, nothing else.
- **Couriers see only the car on their shift:** `Shift.car` gains `vin: string | null`. Lists and `GET /api/shifts/today` carry it, but the `buses` pick list does not, so a courier never gets the VINs of other cars. Dispatchers get the same `Shift` (VINs aren't personal data), but the review UI doesn't show it.
- **Talon photo is owner-only:** one slot `talon` per car, in table `car_photos`, key `firms/{firmId}/cars/{carId}/talon/{uuid}`. Library or camera, the same types and 10 MB as other photos. Replacing or removing deletes the old file. No slots on web (same as documents). Couriers and dispatchers never get it.
- **Tracked dates** (all optional, all owner-only):
  - TÜV/HU due: a **month** (`YYYY-MM`, as on the sticker and in Teil I "HU bis"), stored as a `date` set to that month's **last day**, so it stays valid through the whole month.
  - Insurance expires on: a date.
  - Next service: a date and/or a km reading (`serviceDueKm`).
- Warnings (`carWarnings(car, today)` in `src/domain/fleet.ts`): `tuv`, `insurance` or `service` when the date has passed or falls within 30 days (reuse `EXPIRY_WARNING_DAYS`), and `service` also when the car's current km is within 1,000 km of `serviceDueKm` or past it. The car's current km is the highest `endKm` of any submitted or approved shift with that car (`odometerKm`, null if none). Warnings are shown to the owner only.
- **Owner UI:** tapping a car in Depots & cars now pushes a **car screen** (`profile/vehicle?id=`) instead of opening the sheet. The plate/depot/archive sheet (`profile/car`) still opens from that screen's "Edit" header button and from "Add car".
- The papers are saved as a whole (VIN + three dates + service km) with one Save button, like a document section. The photo uploads right away, separately. Archived cars still open the car screen and their papers stay editable.
- **Courier UI:** a VIN row (`VinRow`: label, monospace-ish tabular VIN, QR icon button, Copy icon button) sits in the Route card under the bus picker, and in the shift detail (`/shifts/[id]`) car line for any status. The row is hidden when the car has no VIN. The QR button opens the `shifts/vin` form sheet (params `vin`, `plate`): a big QR (240 pt) on a fixed white tile, the VIN, and a full-width "Copy VIN" button. Copy changes the label to "Copied" for 2 s, and Android shows its own toast.
- **QR colours** must be dark-on-light in dark mode too, so scanners read it: new tokens `qr-paper` (#FFFFFF) and `qr-ink` (#000000) with the same value in both modes, read with `useThemeColor`.
- New icons: `qr` (`qrcode` / `qr_code_2`), `copy` (`doc.on.doc` / `content_copy`), `document` for the talon slot label if needed (`doc.text` / `description`).
- Talon slot aspect ratio: 105 × 74 mm (A7 landscape, estimated from the real document). `TALON_RATIO` in `src/domain/photos.ts`.
- No design was attached. The screens use existing primitives (Surface, FleetRow, TextField, DateField, PhotoSlot, ExpiryLine, Button, IconButton, Tag) and tokens. Send a design if you want them to match one.

## Out of scope
- Couriers or dispatchers seeing talon photos or the dates.
- Push or email reminders for TÜV/insurance/service. Warnings are shown in the app only.
- Scanning a VIN with the camera to fill it in.
- Brightness boost on the QR sheet (would need `expo-brightness`).
- History of past TÜV/service dates. Only the current values are kept, plus who saved last.
- Photo expiry (the 2-week vehicle check photo expiry is still postponed).

## Steps

### 1. Dependencies, schema, domain rules
- `npx expo install react-native-svg react-native-qrcode-svg expo-clipboard`, then `npx expo-doctor`.
- `src/db/schema.ts`: `cars` gains `vin text` (nullable), `tuvDueOn date`, `insuranceExpiresOn date`, `serviceDueOn date`, `serviceDueKm integer`, `papersUpdatedBy text`, `papersUpdatedAt timestamptz`; unique index `(firm_id, vin)` (nulls stay distinct). New table `car_photos` (`id`, `firm_id`, `car_id` → cars, `slot` enum `car_photo_slot` = `talon`, `object_key`, `content_type`, `size`, `uploaded_by`, `uploaded_at`; unique `(car_id, slot)`), shaped like `shift_photos`.
- `npm run db:push` (two passes if it asks about renames: the columns first, then `car_photos`; empty `pay_rates` first if it asks to truncate), then `npm run db:seed`.
- `src/domain/fleet.ts`: `normalizeVin`, `validVin`, `MAX_VIN_INPUT`, `tuvMonthToDay("2027-03") → "2027-03-31"` and back, `parseCarPapers(body)` (exactly `{ vin, tuvDue, insuranceExpiresOn, serviceDueOn, serviceDueKm }`, each null or valid: VIN rule, `YYYY-MM`, real dates, km an integer 0–9,999,999), `carWarnings`. `src/domain/photos.ts`: `carPhotoSlots = ["talon"]`, `TALON_RATIO`, `parseCarPhotoRequest/Confirm/Query`, `carPhotoPrefix(firmId, carId, slot)`.
- `src/domain/types.ts`: `CarPapers` (the five fields), `CarWarning`; `FleetCar` gains `vin`, `papers`, `odometerKm`, `hasTalon`; `CarDetail = FleetCar & { photos: { talon?: DocumentPhoto }; papersUpdatedAt }`; `Shift.car` gains `vin`.
- Extend `scripts/check-fleet` rules or add a pure `scripts/check-car-rules.mjs` (VIN cases incl. `ZFA250006SMC06228` ok, I/O/Q rejected, 16/18 chars rejected, spaces normalised; TÜV month → last day incl. February leap year; warning thresholds at 30/31 days and 1,000 km).
- Done: tsc + lint pass, rules script passes.

### 2. API
- `src/server/fleet.ts`: `fleetOf` returns the new fields plus `today` (firm's today, from the owner context) so the app can compute warnings; `odometerKm` via one grouped `max(end_km)` query over submitted/approved shifts of the firm. `carOf(firmId, id)` → `CarDetail` with a signed talon URL. `saveCarPapers(firmId, userId, id, papers)` (`taken` on duplicate VIN, via `uniqueWrite`).
- `src/server/car-photos.ts`: start/keep/remove like `shift-photos.ts` (key prefix check, `headObject` size/type, delete previous file).
- Routes (all `ownerContext`; another firm's car → 404; `isId` check):
  - `GET /api/fleet` (adds the fields and `today`).
  - `GET /api/fleet/cars/:id` (CarDetail).
  - `PATCH /api/fleet/cars/:id` also accepts `{ papers: {...} }` alone (`parseCarPatch` gets the third shape; mixing with plate or archived is `invalid`).
  - `POST|PUT|DELETE /api/fleet/cars/:id/photos` (`{ slot, contentType }` → `{ key, uploadUrl }`; `{ slot, key }` → CarDetail; `?slot=` → CarDetail).
- `src/server/shifts.ts`: the shift select joins `cars.vin` into `car`.
- `scripts/check-fleet.mjs`: owner GET/PATCH papers; VIN taken; invalid bodies; courier, dispatcher → `role` on every new route; Firm B owner → 404 on Ivanov's car and photos; photo key from another car/firm → `invalid`; replacing deletes the old R2 object; courier's own today shift carries the VIN, and `buses` has no `vin`.
- `scripts/seed.mjs`: VINs on the seeded cars; one car with TÜV due this month, one with expired insurance, one with service km within 1,000 of its latest shift.
- Done: `npm run check:fleet` and the existing checks (`check:api`, `check:approvals`, `check:shift-photos`) pass.

### 3. Owner car screen
- `src/fleet/fleet.tsx`: `useFleetActions` gains `saveCarPapers`, and the fleet answer keeps `today`. New `useCar(id)` hook in `src/fleet/car.ts` (GET detail, photo add/remove through `uploadPhoto()` to `/api/fleet/cars/:id/photos`, papers save).
- `src/app/(app)/profile/vehicle.tsx` (registered in the profile stack, title = plate, back title "Depots & cars", header button "Edit" → `/profile/car?id=`), body in `src/components/fleet/car-papers.tsx`:
  - Talon card: `PhotoSlot` (`TALON_RATIO`, sources both, view full screen with `PhotoViewer`).
  - Papers card: VIN `TextField` (autoCapitalize characters, error "17 letters and digits, no I, O or Q", taken error); TÜV month field (a `MonthField`: prev/next `IconButton`s around "March 2027" plus a Clear button; built from existing primitives); Insurance `OptionalDateField`; Service date `OptionalDateField` + service km `NumberField`. `ExpiryLine` under each date; under service km "Now 182,340 km · 2,660 km to go" when `odometerKm` is known. Save button (disabled until changed) with saving/offline/error alerts; typed values stay on failure.
  - Loading, error/offline (`LoadState`), and missing car (go back).
- `profile/fleet.tsx`: car rows push `/profile/vehicle`; a row's detail shows the warning ("TÜV due in 12 days", "Insurance expired") in `danger`, or "TÜV 03/2027" otherwise; a `Tag` `warning` count on the depot header when any car warns.
- Done: on the user's Samsung, add VIN, dates and a talon photo, see warnings in the list.

### 4. Courier VIN row and QR sheet
- `src/components/shifts/vin-row.tsx` (`VinRow { vin, plate }`) and `src/components/shifts/vin-sheet.tsx`, route `src/app/(app)/shifts/vin.tsx` (form sheet, `fitToContents`, grabber), registered in the shifts layout. QR via `react-native-qrcode-svg` (`value=vin`, `size=240`, `color=qr-ink`, `backgroundColor=qr-paper`, quiet zone 16) on a `qr-paper` `rounded-md` tile.
- RouteCard: render `VinRow` under the pickers using the shift's car (`shift.car.vin`) once the picked bus is saved (when the picked bus differs from `shift.car.id`, the row waits for autosave). `/shifts/[id]`: `VinRow` under the car line for any status.
- Copy: `Clipboard.setStringAsync(vin)`, label "Copied" for 2 s (Reanimated-free, a plain state swap), accessibility announcement.
- Done: on the Samsung, the QR scans with the phone camera / another phone and reads exactly the VIN; Copy pastes it.

### 5. Strings, tokens, icons, docs
- `src/global.css`: `--color-qr-paper`, `--color-qr-ink` (same in dark). `src/components/icons.ts`: `qr`, `copy`, `document`.
- Strings in en/bg/de under `fleet.papers.*` (titles, labels, VIN errors, warnings, month field, km line) and `shifts.vin.*` (label, show QR, copy, copied, sheet title "Scan the VIN"). BG: "Малък талон", "ГТП" for TÜV; DE: "Fahrzeugschein (Zulassungsbescheinigung Teil I)", "HU/TÜV".
- `/design-system` showcase: none needed (no new shared primitive, `MonthField` stays in `components/fleet/`).

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.
- `node --no-warnings scripts/check-car-rules.mjs` (or the rules part of check-fleet).
- After `npm run db:seed`, with the dev server running: `npm run check:fleet`, `check:api`, `check:approvals`, `check:shift-photos`, `check:details`.
- Roles: courier/dispatcher get `role` on `/api/fleet/cars/:id` and `/photos`; Firm B owner gets 404 for Ivanov cars; a courier's `GET /api/shifts/today` shows only their shift car's VIN.
- On the user's Samsung (they run Metro, reload after changes):
  1. Owner: Profile → Depots & cars → a car → enter `zfa 250006 smc06228` → saved as `ZFA250006SMC06228`; set TÜV to this month → list shows the warning; add, replace, remove the talon photo; go offline → save fails, values kept.
  2. Courier A: Shifts → start shift with that car → VIN row shows → QR sheet → scan with another phone reads `ZFA250006SMC06228` → Copy, paste in a notes app.
  3. Dark mode: the QR stays black on white.
  4. Courier with a car that has no VIN: no row.
- Not available on this machine: the iOS simulator screenshot step (Windows). I'll list that as ❌.

## AGENTS.md updates
- **Data → tables:** add `car_photos` (one per car and slot; only the R2 object key), and say `cars` carries the VIN and papers columns.
- **Files:** car photo keys `firms/{firmId}/cars/{carId}/{slot}/{uuid}`.
- **API:** `GET /api/fleet` also answers `today`; `GET /api/fleet/cars/:id`; `PATCH …/cars/:id` `{ papers }`; `POST|PUT|DELETE /api/fleet/cars/:id/photos`; `Shift.car` carries `vin`, `buses` never does.
- **Domain → Car:** VIN rule, unique per firm, TÜV month stored as last day, warnings (30 days, 1,000 km, odometer = max end km of submitted/approved shifts), talon owner-only.
- **Shift form:** VIN row + `shifts/vin` QR sheet; QR uses `qr-paper`/`qr-ink` tokens.
- **Who sees what:** courier sees their shift car's VIN; owner manages car papers.
- **Commands:** add `check:car-rules` if it becomes its own script.

## Result
Built as planned. The owner opens a car from Depots & cars to keep its VIN, TÜV month, insurance and service dates and one talon photo, with warnings in the screen and the list. The courier sees the shift car's VIN with a QR sheet and Copy.

Changes from the plan:
- API checks are their own script, `check:car-papers`, so they get fresh Clerk tokens. The pure rules are in `check:car-rules`.
- `car_photos.slot` is `text`, like `shift_photos`, not an enum.
- There's no header "Edit" button (no screen uses header buttons). A plate/depot row at the top of the car screen opens the car sheet. Archived cars open the car screen too.
- The car detail answers the firm's `today`, so the screen doesn't depend on the fleet list.
- The service date gets no countdown line (a "valid for" text doesn't fit a service). The km line ("Now 182,340 km · 2,660 km to go") and the warnings cover it.
- The new `warning` Tag tone (danger, no dot) is for the depot header's "To check: n".
- Drizzle leaves columns unqualified in a one-table select, so the odometer and talon subqueries name `"cars"` in full.

Checked: tsc, lint, `check:car-rules`, `check:car-papers`, plus every existing check (`fleet`, `api`, `approvals`, `calendar`, `shift-photos`, `details`, `pay`, `pay-rates`, salary and rules scripts). Not checked here: the on-device run on the user's Samsung (QR scan, Copy, dark mode) and the iOS simulator screenshot (Windows).

Follow-up after testing on the phone:
- The QR came out blank because Tailwind v4 dropped `qr-paper`/`qr-ink` (no className used them), so `useThemeColor` returned nothing. At the user's request the QR now follows the theme (`ink` on `surface`), and the two tokens are gone.
- Couriers can no longer change the start time (the user's call, against cheating): the TimeCard "Edit" and `startedAt` in `PATCH /api/shifts/today` are removed, and reviewers still correct times.
- `PhotoSlot` choices open the themed `ActionSheet` (new primitive, `scrim` token) instead of the system alert.
