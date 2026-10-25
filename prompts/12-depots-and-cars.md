# 12 · Depots and cars

Status: done

## Goal
Owners manage their firm's depots (stations) and cars (plates) in the app. They can add, rename, and archive them, move a car to another depot, and restore archived ones. Everything lives under Profile → Depots & cars. Couriers' shift forms only offer active depots and cars, so a new car shows up there right away and an archived one disappears. Past shifts keep their depot and car.

## Decisions
- **Owners only.** Dispatchers and couriers don't see the section, and every fleet API route answers `role` (403) for them. This matches the existing "Who sees what" table, so AGENTS.md needs no permission change.
- **Actions:** create, rename (and change a car's depot), archive, restore. Nothing is ever hard-deleted (salary history points at these rows).
- **Placement:** Profile becomes a stack. Owners see a "Firm" section with a "Depots & cars" row that opens the fleet screen. Add and edit happen in form sheets, like the reject sheet.
- **Restore** exists because names and plates stay unique per firm, archived rows included (current unique indexes). Without Restore, an archived name could never be used again. Restoring a car needs its depot to be active.
- **Archiving a depot** is blocked while it still has active cars (new error `depotHasCars`, 409). The owner moves or archives the cars first. That way an active car never points at an archived depot. Dispatcher assignments (`dispatcher_depots`) stay as they are, so dispatchers keep seeing the depot's past shifts.
- **Archiving doesn't touch shifts.** A courier's draft that already uses the car keeps it. Only new picks are limited to active rows, as `ownsDepotAndCar` already does.
- **Depot name:** trimmed, inner whitespace collapsed to one space, 1–60 characters, case kept. Unique per firm, case-insensitive.
- **Plate:** trimmed, uppercased, inner whitespace collapsed to one space, 1–15 characters of letters (any script, so Cyrillic BG plates work), digits, spaces and `-`. Unique per firm after normalising. Stored normalised.
- **Duplicates** answer a new error code `taken` (409). The sheet shows "A depot with this name already exists" or "A car with this plate already exists" under the field.
- **Data:** one `GET /api/fleet` returns every depot with its cars, active and archived. A firm has tens of rows, not thousands, so there's no paging.
- **No schema change.** `depots` and `cars` already have `firm_id`, `archived_at` and unique indexes. The case-insensitive check happens in the API with `lower()` in the query (the per-firm list is small).
- **No design attached.** The screens are built from Design Board patterns and existing primitives, with no new tokens.

## Out of scope
- Assigning dispatchers to depots (a later "manage people" feature). Couriers aren't assigned to depots either.
- Dispatcher access, read-only or otherwise.
- Car details beyond the plate (model, mileage, documents), and filtering the courier's car picker by depot.
- Firm settings (currency, timezone, logo) editing.

## Design
Built from Design Board panels and existing primitives. Every value maps to an existing token.

- **Profile (owners):** below the user block and above Sign out, a `footnote` `ink-muted` section label "Firm", then a `Surface` (`rounded-lg`) with one full-width row: `depot` icon (`md`, `ink`), "Depots & cars" in `body` `ink`, and a `chevron` in `ink-muted` on the right. The row is `px-4 py-3`, at least 44 dp high, and highlights `secondary-soft` on press. Dispatchers and couriers see Profile exactly as today.
- **Fleet screen** (`/profile/fleet`): a native header titled "Depots & cars" with Back to Profile, and a `ScrollView` `bg-canvas` `px-4` `gap-4` under it.
  - The top is a `Button` "Add depot" (`secondary`, full width) with a `plus` icon if `Button` supports one.
  - One `Surface` per active depot, sorted by name:
    - A header row (`px-4 py-3`, pressable, highlights `secondary-soft`) with the `depot` icon, the name in `label` `ink`, "N cars" in `footnote` `ink-muted`, and a `chevron`. Tapping it opens the depot sheet in edit mode.
    - A `Divider`, then one row per active car, sorted by plate: the `car` icon (`ink-muted`), the plate in `body` `ink` with tabular figures, and a `chevron`. Tapping a row opens the car sheet. Rows are separated by `Divider`.
    - A last row "Add car" with a `plus` icon, both `secondary-ink`. It opens the car sheet with this depot preselected.
  - **Archived** (only when anything is archived): a `footnote` `ink-muted` label "Archived", then one `Surface` listing archived depots and archived cars. Each row has its icon, the name or plate in `body` `ink-muted`, and for cars the depot name in `footnote` `ink-muted`, plus a `Tag` "Archived" (neutral tone). Tapping a row opens its sheet in archived mode.
- **Depot sheet** (`/profile/depot?id=`): a form sheet like reject (`fitToContents`, grabber, corner 20), `px-4 pt-6` with bottom inset, `gap-4`.
  - The title in `title`: "New depot", "Edit depot", or "Archived depot".
  - A `TextField` labelled "Name", which autofocuses when creating. An error from the API shows under it.
  - A `Button` "Save" (`primary`), disabled while unchanged or empty and loading while saving.
  - In edit mode, a `Button` "Archive depot" (`secondary`, danger tone if `Button` has one, else secondary). It first asks in a native `Alert.alert` with Cancel and Archive. When the depot has active cars, an inline `Alert` explains "Move or archive this depot's cars first".
  - In archived mode, the field is read-only and the only button is "Restore" (`primary`).
- **Car sheet** (`/profile/car?id=&depotId=`): the same shell. The title is "New car", "Edit car", or "Archived car".
  - A `TextField` "Plate" (`autoCapitalize="characters"`, `autoCorrect={false}`), with a hint under it showing the normalised plate once it differs from the typed text.
  - "Depot" as a wrapping row of `Chip`s, one per active depot, single select.
  - "Save", then "Archive car" (edit mode) or "Restore" (archived mode). A car whose depot is archived can't be restored: an inline `Alert` says "Restore its depot first".
- **States:** a skeleton while loading (two grey `Surface` blocks), an `Alert` with Retry on error, the offline `Alert` when there's no connection, and an empty state with "No depots yet" (`body` `ink-muted`, centred) under the Add depot button. In a sheet, a failed save keeps what was typed and shows the error `Alert` above the buttons.
- **Motion:** the list fades up on first load only (the house curve, with reduced motion as a fade only). Sheets and the push stay native. Rows highlight their background and use no `PressableScale`.

## Steps

### 1. Domain: fleet input rules
Add `src/domain/fleet.ts` (pure, type imports only, like `shift.ts`) with:
- `normalizeDepotName(text)`.
- `normalizePlate(text)`.
- `parseDepotCreate(body)` → `{ name }`.
- `parseDepotPatch(body)` → `{ name? } | { archived: boolean }`.
- `parseCarCreate(body)` → `{ plate, depotId }`.
- `parseCarPatch(body)` → `{ plate?, depotId? } | { archived: boolean }`.

All parsers return the existing `Parsed<T>` shape, reject unknown keys and empty patches, and normalise before checking lengths and the plate pattern. Use `isId` from `shift.ts` for IDs.

Add these to `src/domain/types.ts`:
- `FleetDepot = { id; name; archived: boolean; cars: FleetCar[] }`
- `FleetCar = { id; plate; depotId; archived: boolean }`
- `Fleet = { depots: FleetDepot[] }`
- the `ApiErrorCode` values `taken` and `depotHasCars`, both 409 in `statusOf` in `src/server/auth.ts`.

Done when a one-off `node --no-warnings` run (not committed) shows that `normalizePlate(" ca 1234 ab ")` returns `"CA 1234 AB"`, Cyrillic `"са 1234 ав"` normalises to uppercase Cyrillic, and `"A$B"` is rejected. `tsc` must pass.

### 2. Server: owner session and fleet queries
- In `src/server/auth.ts`, add `requireOwner(request)`, shaped like `requireReviewerSession`, which returns `{ firmId, userId }` only for `org:owner` and `role` otherwise.
- Add `src/server/fleet.ts`. Every query filters by `firmId` and uses Drizzle parameters only:
  - `fleetOf(firmId)` returns depots with nested cars, active first, sorted by name and plate. A car always sits under its own depot, archived or not.
  - `createDepot` and `renameDepot` check for a case-insensitive duplicate (`lower(name) = lower($1)`, excluding self) and return `taken`. Also catch the unique-index violation (code `23505`) as `taken`, for races.
  - `setDepotArchived(firmId, id, archived)`: archiving with active cars returns `depotHasCars`.
  - `createCar`, `updateCar` (plate and/or depot) and `setCarArchived`. The target depot must be an active depot of this firm, else `invalid`. Restoring a car whose depot is archived returns `invalid`.
  - Rows of another firm and unknown IDs return `notFound`.
- Archive and restore set or clear `archived_at`. Nothing deletes.

Done when `tsc` and lint pass.

### 3. API routes
Each route uses `handle`, then `requireOwner`, then `firmSettings`/`loadFirm`, answering `firmNotSetUp` like the other contexts, before any work:
- `src/app/api/fleet/index+api.ts`: `GET` returns `Fleet`.
- `src/app/api/fleet/depots/index+api.ts`: `POST { name }` returns 201 and the `FleetDepot`.
- `src/app/api/fleet/depots/[id]+api.ts`: `PATCH { name } | { archived }` returns the `FleetDepot`.
- `src/app/api/fleet/cars/index+api.ts`: `POST { plate, depotId }` returns 201 and the `FleetCar`.
- `src/app/api/fleet/cars/[id]+api.ts`: `PATCH { plate?, depotId? } | { archived }` returns the `FleetCar`.

Invalid IDs in the URL answer `notFound`, and bad bodies `invalid`. Bodies carry only the error code.

Done when `curl` with an owner token creates a depot and a car, and a dispatcher token gets 403.

### 4. Check script: `npm run check:fleet`
Add `scripts/check-fleet.mjs` using `scripts/lib/api-test.mjs`, and a `check:fleet` script in `package.json` (same flags as `check:calendar`). It writes rows named `Check <run id>` and removes them with SQL at the end. Hard-deleting them is fine here because no shift references them. The checks:
- **Owner:** list, create a depot, duplicate name in a different case → 409 `taken`, rename, create a car (plate normalised in the response), duplicate plate → `taken`, move the car to another depot, archive the depot while the car is active → `depotHasCars`, archive the car and then the depot, try to restore the car while its depot is archived → `invalid`, restore the depot and then the car.
- **Courier side:** after archiving, the car is missing from courier.a's car options (`GET /api/shifts/today`). After restoring, it is back.
- **Dispatcher and courier:** every fleet route → 403 `role`.
- **Tenant isolation:** courier.b (Firm B) → 403. The Ivanov owner can't PATCH a Firm B depot or car (IDs read with SQL) → 404, and Firm B's rows are unchanged afterwards. The Ivanov owner's `GET /api/fleet` contains no Firm B rows.
- **Bad input:** empty name, a 61-character name, plate `A$B`, a non-UUID ID, unknown keys → 400. `depotId` of another firm → 400.

Done when every check passes against the dev server after `npm run db:seed`.

### 5. App: data hook and Profile stack
- Add `src/fleet/fleet.tsx`: a `FleetProvider` (a shared revision, as in `ApprovalsProvider`), `useFleet()` (built on `useResource`, with a quiet reload on focus) and mutation helpers `saveDepot`, `saveCar`, `setArchived` via `useApi()`, which return the `ApiFailure` code or the row and bump the revision on success.
- Move `src/app/(app)/profile.tsx` to `src/app/(app)/profile/index.tsx` and add `profile/_layout.tsx`. It is a `Stack` inside `FleetProvider`: index with no header, `fleet` with a native header ("Depots & cars", back title "Profile"), and `depot` and `car` as form sheets with the reject sheet's options.
- Add the owners-only "Firm" section to Profile index (role from `useFirm()`; `firm.role === "owner"`).

Done when the Profile tab still opens and signs out as before for every role, and owners see the row.

### 6. App: fleet screen and sheets
Build `profile/fleet.tsx`, `profile/depot.tsx` and `profile/car.tsx` as described in Design, with components in `src/components/fleet/`. Add every string to `src/i18n/locales/{en,bg,de}.json` under `fleet.*` and `profile.firm`. BG uses "Депо"/"Депа" and "Автомобил"; DE uses "Depot"/"Depots" and "Fahrzeug" ("Kennzeichen" for plate).

Sheets read the row from the provider's cached `Fleet` by `id`, so no extra request is needed. Save maps API codes to field or inline errors:
- `taken` → under the field
- `depotHasCars` → inline `Alert`
- `offline` → offline `Alert`, keeping what was typed
- anything else → generic error `Alert`

Close the sheet on success.

Done when an owner can do every action from the check script by hand on the phone, and lint and `tsc` pass.

## Verification
1. `npx expo lint` and `npx tsc --noEmit` pass.
2. `npm run db:seed`, then `npm run check:fleet`, `check:api`, `check:approvals` and `check:calendar` all pass. The last three confirm that nothing in shifts regressed.
3. On the phone (the user runs Metro and reloads):
   - As the **owner**: Profile → Depots & cars lists the seeded depots with their cars. Add depot "Test Depot", add car "ca 9999 xx" to it (it shows as `CA 9999 XX`), rename the depot, and move the car to HBW1. Try to archive HBW1 (blocked with the message), then archive the car (it moves to Archived) and restore it.
   - Try a duplicate plate (error under the field). Turn on airplane mode and save (offline alert, the typed text stays).
   - Check that dark mode and BG/DE strings fit.
   - As **courier.a**: the new car appears in the Shifts form car picker, and an archived car doesn't.
   - As the **dispatcher**: Profile shows no Firm section.
4. Screens are compared against Design Board patterns (no attached design). Every estimated value is listed in the report.

## AGENTS.md updates
- **API** (Who owns what): add the owner routes `GET /api/fleet`, `POST /api/fleet/depots|cars`, `PATCH /api/fleet/depots/:id|cars/:id` (`requireOwner`; create, rename or move, archive and restore; never delete). Add `check:fleet` to Commands.
- **Domain → Depot/Car:** names are unique per firm case-insensitively, archived ones included (restore instead of re-creating). Plates are stored normalised (uppercase, single spaces). A depot can't be archived while it has active cars, and a car can't be restored into an archived depot.
- **Shift form** line: Profile is a stack (`src/app/(app)/profile/`), and fleet management lives there for owners, with data from `src/fleet/`.

## Result
Built as planned. Owners manage depots and cars under Profile → Depots & cars, using form sheets. `npm run check:fleet` passes all 33 checks, and `check:api`, `check:approvals` and `check:calendar` still pass. Lint and `tsc` are clean. Deviations:
- `src/domain/fleet.ts` has its own UUID check instead of importing `isId`, because domain files only share types.
- "Add depot" is a plain secondary button with no plus icon (`Button` has no leading-icon slot for `md`), and "Archive" uses the existing `destructive` ghost variant.
- The archived tag uses the `role` tone (outlined, no dot), since `Tag` has no neutral tone without a dot.
- The phone walkthrough (step 3 of Verification) is left to the user. There's no iOS simulator on this Windows machine.
