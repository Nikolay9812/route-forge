# 23 · Mechanic role and service log

Status: done

## Goal
A new firm role, **mechanic**, gets one simple tab, **Cars**. They pick a plate and see its papers (with the talon), the vehicle check photos from the last 7 days with each courier's name, and the car's service log. They add dated notes to it (tyres, oil, brakes and so on, with km, text and up to 3 photos). The owner reads every note in Profile → **Service log**, filtered by car and type, and can add notes too. The car's own screen shows its notes as well.

## Decisions
- **Role:** Clerk org role `org:mechanic` (app role `mechanic`). It must exist in the Clerk instance's role set beside `org:owner`/`org:dispatcher`/`org:courier`, created in step 1 with the Clerk CLI, or in the dashboard if the CLI can't. `FirmRole` gains `mechanic`; `requireMechanicSession` lives in `src/server/auth.ts` next to the others.
- **Invite:** owners invite mechanics in People like the other roles. `assignableRoles` becomes `courier | dispatcher | mechanic`, so the invite sheet's `SegmentedControl` gets a third segment and the People list a **Mechanics** section. Switching courier ↔ dispatcher ↔ mechanic works as today (it clears depot rows).
- **Scope:** the whole firm. Mechanics see every active car, grouped by depot. No depot rows.
- **Tabs:** mechanics get **Cars** (icon `car`) and **Profile** only. `/` redirects mechanics to `/cars`. Profile shows name, theme toggle and Sign out, nothing else. The tab layout's audience becomes `courier | reviewer | mechanic`.
- **Car data for mechanics** (read-only): plate, depot, VIN, TÜV month, insurance expiry, next service date and km, odometer, `carWarnings`, and the talon photo (signed GET only, no upload/replace/remove). Only the owner edits papers. This changes the AGENTS.md rule "nobody but the owner sees the rest" to "owner and mechanics".
- **Vehicle check photos for mechanics:** shifts driven with that car on the firm's today and the 6 days before (7 calendar days, firm timezone), in any status, including today's draft while the courier is still driving (that's the bus's current state). Newest first, each row shows the date and courier name only (mechanics don't see statuses). Opening one shows its photos read-only in the existing Vehicle check layout (`PhotoViewer` full screen). Shifts with no photos show "No photos". Mechanics never see shift times, km driven, packages, pay or rejection reasons; only the car's odometer from the papers block.
- **Note shape** (`car_notes`): `type` ∈ `tyres | oil | brakes | inspection | repair | other`; `doneOn` (calendar day, firm timezone, today or earlier, at most 1 year back); `km` (optional, 0–2,000,000); `text` (optional when type ≠ `other`, required for `other`, trimmed, up to 1,000 characters); `createdBy`, `createdAt`, `updatedBy`, `updatedAt`. Pure rules in `src/domain/car-notes.ts`.
- **Note photos:** up to 3 slots `photo1..photo3`, camera or library (receipts, parts), JPEG/PNG/HEIC/WebP up to 10 MB, table `car_note_photos`, keys `firms/{firmId}/cars/{carId}/notes/{noteId}/{slot}/{uuid}`. Flow as shift photos: the note is saved first, then photos are added on its screen (start → presigned PUT → keep; remove `?slot=`). Rules join `src/domain/photos.ts`.
- **Editing:** the author (mechanic or owner) edits or deletes their own note within 7 days of `createdAt`; after that it's locked (`notEditable`). The owner can delete any note at any time. Deleting removes the note, its photo rows and R2 files (notes aren't salary history). Every note shows who wrote it, `doneOn`, and "Edited" when `updatedAt` differs.
- **Owner Service log:** Profile → Firm group gets **Service log** (new icon `wrench`: `wrench.and.screwdriver` / `build`), after Depots & cars. The list is newest `doneOn` first, paged by 50, with filters: car (ActionSheet of plates, archived included) and type (chips). The owner's `profile/vehicle` screen gets a **Service log** section with the car's last 5 notes and "See all" (opens the log filtered by that car) plus "Add note".
- **Cars archived:** archived cars drop out of the mechanic's list; their notes stay and show in the owner's log.
- **Dispatchers and couriers** see nothing of this (all new routes answer `role`).
- **API** (all inside `handle`; firm and user from the session; another firm's IDs answer `notFound`):
  - `mechanicOrOwnerContext` for: `GET /api/garage` (active cars by depot, with plate, odometer, warnings count, last note date), `GET /api/garage/cars/:id` (papers, signed talon, the 7-day shift list `[{ shiftId, date, courierName, photoCount }]`, latest 5 notes), `GET /api/garage/shifts/:id` (one in-range shift of a firm car: date, courier name, plate, signed photos; outside the 7 days → `notFound`), `GET /api/car-notes?carId=&type=&before=` (paged), `POST /api/car-notes` `{ carId, type, doneOn, km, text }` (active firm car only), `GET|PATCH|DELETE /api/car-notes/:id`, `POST|PUT|DELETE /api/car-notes/:id/photos` (author within 7 days; answers the note).
  - The owner also uses these same routes; no owner-only copies.
- **Server code:** `src/server/garage.ts` (car list and detail, 7-day shifts, reusing `photosOfShift`, `photosOfCar`, `carWarnings`, `userNames`), `src/server/car-notes.ts` (CRUD, edit window, photo route modelled on `shiftPhotoRoute`).
- **UI** (no design attached; built from existing primitives like Depots & cars and the Vehicle check card. Send a design if you want it matched):
  - `(app)/cars/index.tsx`: depot sections, one row per car (plate in `bodyStrong`, odometer and "Last note 12.10." in `footnote`, a `warning` tag when papers have warnings). Big tap targets, nothing else on screen.
  - `(app)/cars/[id].tsx`: header plate + depot; a big **Add note** `Button` at the top; **Papers** `Surface` (read-only rows, `VinRow`, talon thumbnail); **Vehicle checks** (7-day rows: date, courier name, `photoTag` "Photos 5/8"/"No photos") → `cars/check?shiftId=`; **Service log** (latest notes, "See all").
  - `(app)/cars/check.tsx`: date, courier, plate, the read-only Vehicle check grid.
  - Shared in `src/components/car-notes/`: `NoteRow`, `NoteForm` form sheet (type `Chip`s, `DateField`, km `TextField` numeric, text `TextField` multiline, Save), note screen with `PhotoSlot` ×3 and Edit/Delete (Delete confirms in `ActionSheet`). Used by the mechanic's stack and the owner's Profile stack (`profile/service-log`, `profile/car-note`, `profile/note-form`).
  - Hooks: `useGarage()`, `useGarageCar(id)` in `src/garage/`, `useCarNotes(filter)` and `useCarNote(id)` in `src/car-notes/`.
  - Loading, error (Retry), offline and empty states like `fleet.tsx`. Typed values stay on a failed save.
- All new strings in en, bg and de under `garage.*` and `carNotes.*` (type names: Tyres/Reifen/Гуми, Oil/Öl/Масло, Brakes/Bremsen/Спирачки, Inspection/Inspektion/Преглед, Repair/Reparatur/Ремонт, Other/Sonstiges/Друго).
- **Seed:** a `mechanic+clerk_test` user in Ivanov Transport (created by `db:seed` if missing, or once with the Clerk CLI), and a few notes per car across the last months.

## Out of scope
- Mechanics editing car papers or the talon, or seeing shift details, statuses, km, packages, pay or courier documents.
- Mechanics limited to depots (could be added later with `dispatcher_depots`-style rows).
- Reminders or push notifications ("oil due"), and notes updating the papers' next service automatically.
- Costs, invoices or parts inventory on notes.
- Photo expiry (still postponed for shift photos, see memory).
- Notes on archived cars by mechanics.

## Steps

### 1. Clerk role and test user
- With the Clerk CLI (`MSYS_NO_PATHCONV=1 clerk api ...`; the Clerk MCP server isn't authorised in this session): create the `org:mechanic` role ("Mechanic", no system permissions needed) and add it to the instance's organization role set. If the API refuses, stop and ask the user to add it in the dashboard (Organizations → Roles).
- Create `mechanic+clerk_test@…` (same domain as the other test users) and add them to Ivanov Transport as `org:mechanic`. Note the user in the seed/test helpers.
- Done: `clerk api` lists the role and the membership.

### 2. Domain rules, schema, checks
- `src/domain/car-notes.ts`: `noteTypes`, `NOTE_EDIT_DAYS = 7`, `parseNoteCreate`, `parseNotePatch` (whole note: `type, doneOn, km, text`), `canEditNote(note, userId, now)`, `garageDays(today)` (today and the 6 days before). Types `CarNote`, `GarageCar`, `GarageCarDetail`, `GarageShift` in `src/domain/types.ts`.
- `src/domain/photos.ts`: `carNotePhotoSlots`, `parseCarNotePhotoRequest`/`Keep`/`Remove`, `carNotePhotoPrefix`.
- `src/domain/people.ts`: add `mechanic` to `assignableRoles`. `src/auth/firm.tsx`: `mechanic` in `FirmRole` and the role map.
- Schema: `car_notes` (`id`, `firmId`, `carId` → cars, `type` text, `doneOn` date, `km` int null, `text` text null, `createdBy`, `createdAt`, `updatedBy`, `updatedAt`; index `(firmId, carId, doneOn)`), `car_note_photos` (like `car_photos`, plus `noteId` → car_notes; unique `(firmId, noteId, slot)`). `npm run db:push`.
- `scripts/check-car-note-rules.mjs` + `npm run check:car-note-rules`: types, dates (future, >1 year, bad format), km bounds, `other` needs text, text length, the 7-day window edges, the 7-day shift range, photo slots.
- Done: the rules check, lint and tsc pass; `db:push` succeeds.

### 3. Server and API routes
- `src/server/auth.ts`: `requireMechanicSession` and `requireGarageSession` (mechanic or owner). `src/server/context.ts`: `garageContext` (with firm and `today`).
- `src/server/garage.ts`, `src/server/car-notes.ts` and the routes listed under Decisions. Shift lists join `shifts` on `firmId` + `carId` + date range, names via `userNames`. Signed URLs never logged.
- `src/server/people.ts`: accept `org:mechanic` everywhere it accepts the other two roles; the list returns mechanics.
- Done: lint and tsc pass; `curl` as mechanic returns `/api/garage`.

### 4. API checks
- `scripts/check-garage.mjs` + `npm run check:garage` (tokens from `lib/api-test.mjs`, adding mechanic):
  - courier, dispatcher and courier.b get `role` on every new route; mechanic and owner get 200.
  - mechanic sees only Ivanov's active cars; a Firm B car or shift ID → `notFound`; an archived car → `notFound` for mechanic.
  - car detail: papers present, talon URL present when seeded; the shift list contains only shifts of that car in the 7 days, with names, no km/pay/status fields.
  - `/api/garage/shifts/:id` for an 8-day-old shift → `notFound`.
  - mechanic gets `role` on `/api/fleet`, `/api/fleet/cars/:id` PATCH, talon upload, `/api/approvals`, `/api/people`, `/api/pay-rates`, `/api/couriers`.
  - notes: create (201), invalid bodies → `invalid`, edit own → 200, edit owner's note → `notEditable`, a note older than 7 days (seeded) → `notEditable` for its author, owner deletes any note → 200 and its R2 objects are gone; photos: start/keep/remove, wrong-prefix key → `invalid`.
  - `check:people`: inviting as `mechanic` works; switching courier.c → mechanic → courier round trip.
- Done: `npm run check:garage` and `npm run check:people` all ✅.

### 5. App: mechanic tabs and Cars screens
- `(app)/_layout.tsx` (mechanic audience, Cars tab), `src/app/index.tsx` redirect, `(app)/cars/_layout.tsx` stack with the note form sheet, the three Cars screens, `src/garage/` hooks. Profile shows nothing role-specific for mechanics.
- Done: lint and tsc pass; regenerate typed routes if tsc can't see the new screens. Ask the user to reload on their phone, sign in as the mechanic and check the list, a car, a check, and adding a note with a photo.

### 6. App: notes for the owner
- `src/car-notes/` hooks, `src/components/car-notes/`, icon `wrench`, the Profile row, `profile/service-log` (filters, paging), `profile/car-note`, the note form sheet in `profile/_layout.tsx`, and the Service log section on `profile/vehicle`. People: Mechanics section and the third invite segment.
- Done: lint and tsc pass; the user checks on their phone.

### 7. Seed
- `db:seed` adds notes for Ivanov's cars (some older than 7 days, some with a photo-less `other`), and keeps the mechanic membership.
- Done: `npm run db:seed` then `npm run check:garage` ✅.

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `npm run check:car-note-rules`, `check:garage`, `check:people`, `check:fleet`, `check:car-papers`, `check:shift-photos` (nothing older broke).
- On the phone (the user runs Metro): sign in as mechanic → only Cars and Profile tabs; open a car → papers + talon, checks from the last 7 days with names; open one → photos; add an oil note with km and a photo; edit it; sign in as owner → Profile → Service log shows it with the mechanic's name and date; filter by that car and by Oil; the car's screen shows it; delete it. Sign in as dispatcher and courier → nothing new visible. Dark mode and Bulgarian once each.

## AGENTS.md updates
- Organizations: roles add `org:mechanic`; owners invite courier, dispatcher or mechanic.
- Routing: mechanics get Cars and Profile; `/` redirects them to `/cars`.
- Data: tables `car_notes`, `car_note_photos`; Files: the note photo key.
- API: the `garage` and `car-notes` routes and `garageContext`.
- Domain: Car papers visible to owner and mechanics (replaces "nobody but the owner sees the rest"); a **Service log** bullet (types, dates, 7-day author edits, owner deletes any).
- Who sees what: a mechanic row (all active cars' papers and talon, 7 days of vehicle check photos with courier names, the service log; can add notes and edit their own for 7 days).
- Commands: `check:car-note-rules`, `check:garage`.

## Result
Built as planned. Clerk dev has `org:mechanic` (read-members permission, in the default role set) and the test user `mechanic+clerk_test@example.com` (Max Mechanic) in Ivanov Transport. Server: `src/server/garage.ts` (reuses `fleetOf`/`carDetail`), `src/server/car-notes.ts`, `garageContext`, six routes under `api/garage` and `api/car-notes`. App: the Cars tab (`src/app/(app)/cars/`: list, car, check, note, note form, log, VIN sheet), the owner's Profile → Service log, the car screen's last 5 notes, and mechanics in People. Additions beyond the plan: a mechanic can open the full log from a car ("See all"), `VinRow` takes the stack's QR sheet path, and `TextField` grows when `multiline`. Checks: `check:car-note-rules`, `check:garage` (55), `check:people` (mechanic invite and role round trip), plus `check:fleet`, `check:car-papers`, `check:shift-photos` all pass; lint and tsc clean. On the Android emulator as the mechanic: tabs, car list, car screen, adding an oil note, two photo uploads, and deleting (rows and R2 files gone) work. Not tried on a device: the owner screens, edit flow, dark mode and BG/DE.
