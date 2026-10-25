# 10 · Dispatcher approvals

Status: done

## Goal
A dispatcher opens the Approvals tab and sees the submitted shifts from their depots. For each one they can approve it, reject it with reasons (the courier fixes it and resubmits), or correct the numbers or times themselves. Every correction records who changed what and when. Owners can do the same across the whole firm. Couriers see the rejection reasons and which shifts were corrected.

## Decisions
- **Actions:**
  - On a `submitted` shift: approve, reject, or correct.
  - On an `approved` shift: correct only. Months are never locked, so pay follows the correction.
  - On a `rejected` shift: nothing. It waits for the courier, and the detail screen says so.
  - Correcting doesn't change the status: correct a submitted shift, then approve it.
- **Depot access:** a new `dispatcher_depots` table assigns a dispatcher to depots. A dispatcher sees and acts only on shifts whose depot is theirs. A correction can move a shift only to one of their own depots, while buses can be any active car in the firm. An owner has every depot. Couriers get 403 on every approvals route. The seed assigns the test dispatcher to HBW3 and HBW1 (not HBW7), so the out-of-depot case can be checked.
- **Navigation:**
  - The tabs depend on the role: couriers get Home / Shifts / Pay / Profile, dispatchers and owners get **Approvals / Profile**. Unused tabs are hidden with `NativeTabs.Trigger hidden`.
  - `/` redirects signed-in dispatchers and owners to `/approvals`, and everyone else to `/home`. While the role is still loading it renders nothing (the splash is already gone, so this is a blank frame at most).
  - Approvals is a stack: the list → the detail screen (`approvals/[id]`, with a native header showing the courier's name) → the reject sheet (`approvals/reject`, a form sheet).
- **List:**
  - A segmented control switches between **Pending (N)** (submitted shifts, oldest day first) and **Reviewed** (approved or rejected in the last 30 days, newest review first).
  - Rows look like Home's recent shifts: courier name, then date · station · bus, and on the right the duration and status tag, plus a "Corrected" tag (`info` tone) when the shift was corrected.
  - Pull to refresh, and the list reloads whenever the tab or screen comes back into focus. Empty states: "All caught up" (Pending) and "Nothing reviewed in the last 30 days".
- **Reject:**
  - Reasons are multi-select chips:
    - Kilometers don't match
    - Package count is wrong
    - Wrong bus or station
    - Working time is wrong
  - Plus an optional note (max 300 characters). At least one reason or a note is required.
  - Stored as `rejection_reasons text[]` (codes) and `rejection_note`, and shown to the courier translated, with the note as typed. This replaces the free-text `rejection_reason` column.
- **Correct:**
  - The detail screen switches to edit mode, with:
    - station and bus chips;
    - start and finish time as `HH:MM` on the shift's day in the firm's timezone;
    - start km, end km, loaded, returned and pickups.
  - Then Save or Cancel.
  - The server re-checks everything: finish after start, start on the shift's day, end km ≥ start km, returned ≤ loaded, and the depot is one of the dispatcher's. It recomputes `minutes` from the times.
  - Each changed field writes a `shift_changes` row (field, old value, new value, by, at) in the same `db.batch` as the update.
- **Pay on the detail screen:** hours × the rate on that day = pay for this shift (half up, minor units, the same `shiftPay` math with the status treated as approved). The label is "Pay when approved" while the shift is submitted, and "Pay" once approved. It is only shown to dispatchers of that depot and to owners, and never logged.
- **Who reviewed:** new `reviewed_at` and `reviewed_by` columns on `shifts`, set on approve and reject. The courier's resubmit clears the rejection.
- **Names:** courier and dispatcher names come from Clerk (`users.getUserList` by id), cached for 10 minutes per server process. If there's no name, the email is shown.
- **History on the detail screen:** "Corrected by Dora Dispatcher · 25 Oct, 14:02". Underneath, one line per field, e.g. "End km: 48 300 → 48 320".
- **Courier side:**
  - The rejection alert shows the translated reasons and the note.
  - Shifts get `corrected: boolean`, and Home's recent list shows a small "Corrected" tag.
  - Nothing else changes for couriers.
- **Concurrency:** approve and reject are single conditional updates (`where status = 'submitted'`). A second dispatcher acting on the same shift gets 409, and the app reloads the detail screen.
- **The design** comes from the Design Board components (Surface, Tag, Chip, SegmentedControl, TextField, Button, Alert). No new tokens. The design-system rule applies: no design was attached.

## Addendum (approved during the build): courier fixes rejected shifts from any day
- **Gap:** the courier API only handled today's shift, and resubmitting set the finish time to "now". So a shift rejected the next day couldn't be fixed, and fixing it later would have inflated its hours.
- **New courier routes:**
  - `GET /api/shifts/:id` (own shift, any status) → `{ firm, shift, stations, buses }`.
  - `PATCH /api/shifts/:id` (own shift, `rejected` only, the same body as a dispatcher correction: times as `HH:MM`) → the shift.
  - `POST /api/shifts/:id/submit` (own rejected shift) → submitted.
  - A shift that isn't the courier's own gets 404.
- **Submitting keeps existing times:** `finished_at` is set to now only when it is still empty (a draft finishing), and `minutes` comes from the stored times. Resubmitting clears `rejection_*` and `reviewed_*`.
- **One shared edit form** (`src/components/shifts/shift-edit-form.tsx`): station/bus chips, start and finish time (`HH:MM`), start/end km, loaded/returned/pickups, with the same field errors. The dispatcher's correction mode and the courier's fix screen both use it.
- **Courier shift screen** `(app)/shifts/[id].tsx`:
  - A rejected shift shows the reasons, the edit form and "Resubmit".
  - Any other status shows the read-only summary.
  - Home's recent rows and the Today card's "Fix and resubmit" (when today's shift is rejected) open it.

## Out of scope
Bulk approve, assigning depots or dispatchers in the app (the seed does it), the owner's dashboard, the courier Pay tab, notifications, dispatcher filters by courier or depot, editing a rejected shift as dispatcher, and production deployment.

## Data model changes (`src/db/schema.ts`; dev data is wiped and re-seeded)
- `shifts`: drop `rejection_reason`. Add `rejection_reasons text[]`, `rejection_note text`, `reviewed_at timestamptz` and `reviewed_by text`.
- `dispatcher_depots`: `id uuid`, `firm_id`, `user_id text`, `depot_id → depots`, `created_at`. Unique `(firm_id, user_id, depot_id)`.
- `shift_changes`: `id uuid`, `firm_id`, `shift_id → shifts`, `changed_by text`, `changed_at timestamptz default now()`, `field text`, `old_value text`, `new_value text`. Index `(firm_id, shift_id)`.
- Domain `Shift`: `rejectionReason?` becomes `rejection?: { reasons: RejectReason[]; note: string | null }`, plus `corrected: boolean`. `RejectReason = "km" | "packages" | "busOrStation" | "time"`.
- `src/domain/shift.ts` gains `parseReject` and `parseCorrection` (pure), and `diffShift(before, after)` → changed fields for `shift_changes`.
- `src/domain/dates.ts` gains `zonedTime(date, minuteOfDay, timeZone)` → a UTC ISO string (a firm-local wall time to UTC, DST-safe through Intl offsets).

## API routes (dispatcher or owner; the scope is firm + depots)
- `GET /api/approvals?view=pending|reviewed` → `{ firm, pendingCount, items: { shift, courierName }[] }`.
- `GET /api/approvals/:id` → `{ firm, shift, courierName, pay: { hourlyMinor, payMinor } | null, changes: { field, from, to, byName, at }[], stations, buses }`. `stations` are the user's own depots. 404 when the shift is outside their depots or firm (it never reveals that the shift exists).
- `POST /api/approvals/:id` with `{ action: "approve" }` or `{ action: "reject", reasons, note }` → the shift. 409 unless submitted.
- `PATCH /api/approvals/:id` with the correction → the shift. 409 unless submitted or approved. 400 on invalid input.
- `src/server/auth.ts` gains `requireReviewer(request)` → `{ firmId, userId, role, depotIds: string[] | "all" }`.

## Screens
**Approvals list** (`src/app/(app)/approvals/index.tsx`): a ScrollView on canvas, insets as on Home. Header: "Approvals" (`heading`) and the firm name tag (`role` tone). Below it a `SegmentedControl`, then a Surface list of rows (min-h-14, row highlight on press, Divider between rows). Loading uses a skeleton. Error and offline show an `Alert` and Retry. Role-not-allowed shows a `Notice`.

**Detail** (`approvals/[id].tsx`):
- A Surface with the date (`title`) and status Tag (plus the "Corrected" tag), and the summary rows (the same rows as the finish sheet).
- A pay Surface.
- The rejection Alert when the shift is rejected.
- A "Changes" Surface when there are corrections.
- The buttons:
  - Submitted: Approve (primary), Reject (secondary), Correct (secondary).
  - Approved: Correct.
  - Rejected: a footnote, "Waiting for the courier to fix and resubmit."
- Edit mode replaces the summary with the correction form (chips, time fields, number fields), with field errors as on the courier form, plus Save and Cancel.
- After approve, reject or save, the screen updates in place. "Approved" goes back to the list.

**Reject sheet** (`approvals/reject.tsx`, formSheet fitting its content): the title "Send back to courier", the reason chips (multi-select, wrapping), a note TextField (multiline), "Send back" (primary) and Cancel.

## Steps
### 1. Clerk and seed
Create an `owner+clerk_test@example.com` user (owner of Ivanov Transport). Update the schema, then `db:push` to dev. The seed now also writes `dispatcher_depots` (dispatcher → HBW3, HBW1), uses the new rejection columns, sets `reviewed_*` on reviewed history, and spreads the couriers' shifts so that HBW7 has some (courier C).
### 2. Domain
`RejectReason`, the `Shift` changes, `parseReject`, `parseCorrection`, `diffShift` and `zonedTime`. Update `check-salary.mjs` if the shapes change. Done when the type check and the salary check pass.
### 3. Server
`requireReviewer`, `src/server/approvals.ts` (list, detail, approve, reject, correct, every query filtered by firm and depot ids) and the Clerk name lookup with its cache. Then the routes. The courier routes return the new `rejection` and `corrected`, and resubmitting clears `rejection_*` and `reviewed_*`.
### 4. App
- Role-based tabs and the `/` redirect.
- The approvals stack (list, detail with edit mode, reject sheet), with `src/approvals/` hooks on `useApi`.
- The courier rejection alert and the "Corrected" tag.
- Translations in EN, BG and DE.
### 5. Checks
Add `scripts/check-approvals.mjs` (`npm run check:approvals`), then push the schema to `main`.

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `check-salary` and `check:api` (still passing) all pass.
- `npm run check:approvals`:
  - Courier → 403.
  - The dispatcher sees only HBW3/HBW1 shifts, and an HBW7 shift id gets 404.
  - The owner sees HBW7.
  - The Firm B courier's shift id → 404 for the Ivanov dispatcher.
  - Approve → approved and `reviewed_by` set. Approving again → 409.
  - Reject with no reason and no note → 400. With reasons → rejected, and the courier's `GET /api/shifts/today` shows the reasons. The courier fixes it and resubmits, which clears the rejection.
  - Correct end km → `shift_changes` row, `corrected: true`, and the courier's month totals change.
  - Correct moving the shift to HBW7 as dispatcher → 400.
  - Finish before start → 400.
  - The pay on the detail screen matches a hand-calculated value: 8 h 42 min at €16.00 = €139.20.
- **On the phone:**
  - Sign in as the dispatcher: the tabs are Approvals and Profile, and Pending lists the seeded submitted shifts.
  - Open one, check the pay, then approve it: it moves to Reviewed.
  - Reject one with reasons. Sign in as that courier: the reasons show translated, and the courier can fix and resubmit.
  - Correct an approved shift: "Corrected" shows for both sides.
  - Try BG and DE.
- **Logging:** no route logs pay, rates or names.

## AGENTS.md updates
- Domain → Who sees what: the dispatcher's depots come from `dispatcher_depots`, and owners have all depots.
- Domain → Shift: rejection is reason codes plus an optional note. A correction keeps the status and writes `shift_changes`. Reviews set `reviewed_at`/`reviewed_by`.
- Expo: tabs depend on the role (courier: Home/Shifts/Pay/Profile; dispatcher and owner: Approvals/Profile), and `/` redirects by role.
- Who owns what → API: the `requireReviewer` scope and the approvals routes.
- Commands: `npm run check:approvals`.

## Result
Built as planned, plus the addendum: couriers fix and resubmit rejected shifts from any day, and resubmitting keeps the shift's times. `npm run check:approvals` passes all 41 checks, `check:api` passes all 28, and lint, the type check and the salary check pass. Both Neon branches have the schema; only `dev` is seeded.

Notes:
- **Owner test user:** `owner+clerk_test@example.com`, with the same password as the other test users. The dispatcher test account had been changed to `org:owner` in Clerk, and it was set back to `org:dispatcher`.
- **Schema push:** `drizzle-kit push` stops at an interactive rename prompt for `rejection_reason` → `rejection_reasons`, which a non-interactive shell can't answer. The old column was dropped by SQL first, on `dev` and then on `main` (the tables on `main` were empty).
- **Seed depots:** the seed assigns depots by each courier's position in Clerk's member list, and that order isn't stable. `check-approvals.mjs` therefore picks its targets from the API, not from seed positions.
- **Correction history:** the change rows are inserted by `insert … select … where updated_at = <stamp>` in the same `db.batch` as the update, so history is written only when the correction applied.
- **New files:**
  - Shared form logic in `src/shifts/edit.ts`, and the shared UI in `src/components/shifts/shift-edit-form.tsx`.
  - The loader hook `src/api/use-resource.ts`.
  - Shared test helpers in `scripts/lib/api-test.mjs`.
