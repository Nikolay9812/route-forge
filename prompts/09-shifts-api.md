# 09 · Shifts API: Neon + Clerk Organizations

Status: done

## Goal
A courier who belongs to a firm (a Clerk Organization) logs today's shift and it is saved in Neon. Starting, every edit (autosaved) and submitting go through API routes that verify the Clerk session and the courier's firm and role. Home's Today card, month totals and recent shifts read the same data. Both sample files are deleted.

## Decisions
- **Scope:** the Shifts form and Home use real data. Dispatcher approval screens, owner management screens and in-app invites come later.
- **Firms:** Clerk Organizations are turned on. Each firm is an org. Custom roles are `org:owner`, `org:dispatcher` and `org:courier`; Clerk's default `org:admin` / `org:member` are not used. New members default to `org:courier`. Users can't create orgs themselves. I create **Ivanov Transport** (slug `ivanov-transport`) with the Clerk CLI, and a second test firm **Test Firm B** for the isolation checks.
- **Joining:** you invite people from the Clerk dashboard. A signed-in user with no membership sees a full-screen "No firm yet" state on Home and Shifts. It lists pending invitations with an Accept button and has a Refresh button and Sign out. A user with exactly one membership gets that org made active automatically. With several, the first one is used for now; a firm switcher comes later.
- **Who uses these routes:** only `org:courier`. Owners and dispatchers get 403, and the app shows "Your role's screens are coming soon" on Home and Shifts. Their own views are later plans.
- **Session check:** `@clerk/backend` (new dependency, approved). API routes call `clerk.authenticateRequest(request)` with `CLERK_SECRET_KEY` and read `userId`, `orgId` and `orgRole` from `toAuth()`. A missing or invalid session gets 401. A session with no active org, or a role other than courier, gets 403. Firm and user come only from the token, never from the body or URL. The helper lives in `src/server/auth.ts`, which only API routes import.
- **The app calls the API** with relative `fetch("/api/...")`. In development, Expo Router sends these to the Metro dev server. Each request carries `Authorization: Bearer <getToken()>`. A production `origin` (EAS Hosting) comes later.
- **Client data layer:** plain `fetch` in small hooks, with no new library. `src/api/client.ts` exposes `useApi()`: an authed `request<T>()` that sorts failures into `offline` (fetch threw), `unauthorized`, `forbidden`, `notFound`, `conflict`, `invalid` and `error`. Screens import from `src/api/`, never `@clerk/expo`, and `src/auth/` re-exports the token getter.
- **Autosave:** edits during the shift save about 800 ms after the last keystroke. A small status line under the cards reads "Saving…", "Saved" or "Not saved, no connection" (with Retry). Typed values stay on screen whatever happens. A server response never overwrites a field the courier changed after the save started. Finish first flushes any pending save.
- **Stations and buses:** every active (not archived) depot and car in the courier's firm. Courier→depot assignment and default station/bus come in a later plan.
- **Domain logic moves to `src/domain/shift.ts`**, pure and shared by the API and the app: `kmDriven`, `delivered` (loaded − returned), `canStart`, `canFinish`, `validateShiftInput`. `src/shifts/draft.ts` keeps only UI helpers (`digitsOnly`, `parseClock`). The server re-runs every check: the UI hiding a button doesn't count as a permission check.
- **Working time:** `startedAt` is set by Start (and can be moved earlier, the same day, never into the future). `finishedAt` and `minutes = floor((finishedAt − startedAt) / 60 000)` are set by Submit. Calendar day = the firm's timezone at Start.
- **One shift per courier per day:** a unique `(firm_id, user_id, date)` index. Starting twice gets 409, and the app reloads.
- **Editing:** only while `draft` (or `rejected`, ready for the approvals plan). Editing a submitted shift gets 409.
- **Firm settings** (`firm_settings` table): currency and timezone per firm. The firm's name comes from the Clerk org. The seed sets Ivanov Transport to `EUR`, `Europe/Berlin` (KH plates are German).
- **Rates:** a `courier_rates` table (user, effective-from date, hourly in minor units). The seed gives each courier in Ivanov Transport €15.00/h from the 1st of this month, plus €16.00/h from the 15th, so the mid-month change is visible. Pay on Home still counts approved shifts only. Nothing approves shifts yet, so Home shows €0 and "waiting for approval" until the approvals plan, unless the seed's history (next point) is used.
- **Seed history:** the seed also adds about 10 past shifts this month for each courier (mostly approved, one rejected, two submitted), so Home's totals and recent list have something to show. It wipes and re-creates the seeded firm's rows each run (dev data is worthless).
- **Seed script:** `npm run db:seed` → `scripts/seed.mjs`. It looks up the org by slug and its members through the Clerk Backend API (`fetch` with `CLERK_SECRET_KEY`, no package), then writes Neon with parameterized SQL through `@neondatabase/serverless`. It fills Ivanov Transport (HBW3, HBW1, HBW7; KH I 6004, KH I 5120, KH I 7732) and Test Firm B (one depot `TFB1`, one car `B TF 100`).
- **Neon branches:** I create a `dev` branch and point `.env.local` at it before the first push. After verification, I push the same schema to `main` (data loss is fine). The leftover `todos` table is dropped.
- **Corrections audit:** not needed yet. Couriers only edit their own drafts, which isn't a correction. The approvals plan adds the `shift_changes` table.
- **Errors never leak:** routes return `{ error: "<code>" }` with no SQL, stack traces or salary data in logs.
- **Test accounts:** `+clerk_test` emails (code `424242`), created with the Clerk CLI: a courier and a dispatcher in Ivanov Transport, and a courier in Test Firm B. You add your own account to Ivanov Transport as a courier (or tell me its email and I add it).

## Out of scope
Dispatcher and owner screens, approve/reject/correct, in-app invites, courier→depot assignment, default station/bus, firm switcher, EAS Hosting / production origin, push notifications, Pay tab, the shift history screen, offline storage.

## Data model (`src/db/schema.ts`)
All tables have `firm_id text not null` (the Clerk org ID) and `created_at timestamptz default now()`. Archivable tables have `archived_at timestamptz` (never hard-deleted).
- `firm_settings`: `firm_id` (primary key), `currency text`, `time_zone text`.
- `depots`: `id uuid`, `firm_id`, `name text`, `archived_at`. Unique `(firm_id, name)`.
- `cars`: `id uuid`, `firm_id`, `plate text`, `depot_id uuid → depots`, `archived_at`. Unique `(firm_id, plate)`.
- `courier_rates`: `id uuid`, `firm_id`, `user_id text` (Clerk user), `effective_from date`, `hourly_minor integer`. Unique `(firm_id, user_id, effective_from)`.
- `shifts`: `id uuid`, `firm_id`, `user_id`, `date date`, `status` enum (`draft`, `submitted`, `approved`, `rejected`), `depot_id → depots`, `car_id → cars`, `started_at timestamptz`, `finished_at timestamptz null`, `minutes integer null`, `start_km integer`, `end_km integer null`, `loaded integer`, `returned integer null`, `pickups integer null`, `rejection_reason text null`, `submitted_at timestamptz null`, `updated_at timestamptz`. Unique `(firm_id, user_id, date)`, plus an index on `(firm_id, user_id, date desc)`.
- Integers are checked server-side: 0 to 9 999 999. `returned ≤ loaded`, `end_km ≥ start_km`.
- `todos` is removed.

Domain types (`src/domain/types.ts`): `Shift` becomes `{ id, date, status, startedAt, finishedAt, minutes, depot: { id, name }, car: { id, plate }, startKm, endKm, loaded, returned, pickups, rejectionReason? }`. `delivered` and `km` are derived with `src/domain/shift.ts`. `monthTotals` uses `delivered(shift)` and `kmDriven(shift)`. `scripts/check-salary.mjs` is updated to the new shape and must still pass.

## API routes (all courier-only, all scoped by the token's `orgId` + `userId`)
- `GET /api/shifts/today` → `{ firm: { name, currency, timeZone }, date, shift | null, stations: {id,name}[], buses: {id,plate}[] }`.
- `POST /api/shifts/today` with `{ depotId, carId, startKm, loaded }` → 201 with the shift. Sets `startedAt = now` and `date = today` in the firm's timezone. 409 if a shift already exists. 400 if the depot or car isn't an active one in this firm.
- `PATCH /api/shifts/today` with any of `{ depotId, carId, startKm, endKm, loaded, returned, pickups, startedAt }` → the shift. 409 unless draft or rejected. `startedAt` must be today in the firm's timezone and not in the future.
- `POST /api/shifts/today/submit` → the shift. Requires `canFinish`, then sets `finishedAt = now`, `minutes`, `status = submitted`, `submittedAt`. 409 if not draft or rejected, or if `canFinish` fails.
- `GET /api/home` → `{ firm, date, today: Shift | null, recent: Shift[] (5, before today), totals: MonthTotals }`, with this month's shifts and the courier's own rates.
- `src/app/api/health+api.ts` is deleted.

## Steps

### 1. Clerk setup (CLI)
Run `clerk enable orgs`. Then use `clerk api`: create roles `owner`, `dispatcher` and `courier` (role set or org roles, whichever this instance uses), make courier the default role and owner the creator role, and turn off user-created orgs. Create both orgs and the three `+clerk_test` users with their memberships. Record the commands in the Result. Done when `clerk api /organizations` lists both firms with the right members and roles.

### 2. Neon branch, schema, seed
Create the Neon `dev` branch (Neon MCP), update `DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`NEON_BRANCH` in `.env.local`, write the schema, then `npm run db:push`. Add `scripts/seed.mjs` and the `db:seed` script. Done when the seed runs twice in a row without errors and `select count(*)` per table looks right.

### 3. Domain
Write `src/domain/shift.ts` and the new `Shift` type, update `salary.ts` and `scripts/check-salary.mjs`. Done when the type check passes and `node --no-warnings scripts/check-salary.mjs` passes.

### 4. Server
`npx expo install @clerk/backend`. Write `src/server/auth.ts` (`requireCourier(request)` → `{ firmId, userId }` or a Response), `src/server/shifts.ts` (queries, every one filtered by `firmId` and `userId`) and the routes above. Done when each route answers correctly to the API checks in Verification.

### 5. App
- `src/api/client.ts` (`useApi`), `src/api/use-today-shift.ts` (load, start, autosave patch, submit, with loading/error/offline/forbidden/no-firm states) and `src/home/use-home-summary.ts` (body replaced, same shape plus the new states).
- `src/auth/`: `useFirm()` (memberships, auto-activate, pending invitations, accept). `NoFirm` and `RoleNotYet` components.
- The Shifts screen and finish sheet use `useTodayShift()` instead of the context. Delete `src/shifts/shift-draft-context.tsx`, `src/shifts/sample.ts` and `src/home/sample.ts`, and remove the "Sample data" tags and the dev reset button.
- Loading uses skeleton cards. Error and offline use `Alert` + Retry, as on Home.
- Translations in EN, BG and DE for every new string.
Done when lint and the type check pass and the flow works on the phone.

### 6. Push to main
After verification, push the schema to the Neon `main` branch and point `.env.local` back at main (or keep dev; I'll ask then).

## Verification
- `npx expo lint`, `npx tsc --noEmit` and `node --no-warnings scripts/check-salary.mjs` pass.
- **API checks** (`scripts/check-api.mjs`, with Metro running): it mints session tokens for the test users through the Clerk Backend API and calls every route.
  - No token or a bad token gets 401.
  - The dispatcher gets 403.
  - A courier in Test Firm B sees only TFB1 / B TF 100, and patching with Ivanov's depot ID gets 400.
  - Courier A never sees courier B's shift.
  - Start twice gets 409. Patching `endKm < startKm`, then submit, gets 409. `returned > loaded` gets 400. A `startedAt` in the future gets 400. Patching after submit gets 409.
- **On the phone:** sign in as a courier. Shifts shows HBW3/HBW1/HBW7 from Neon. Start, type, and see "Saved". Kill the app and reopen: everything is still there. Turn on airplane mode and type: "Not saved, no connection" appears and the values stay. Turn it off and tap Retry: "Saved". Finish and submit, and the Submitted card shows. Home shows today as Submitted and the seeded month totals.
- **A user with no firm:** sees "No firm yet". Invite them from the dashboard, tap Refresh, accept the invitation in-app, and the form appears.
- **Logging:** no route logs salary, tokens or SQL errors with values.

## AGENTS.md updates
- Who owns what → Auth: the Clerk Organizations setup (roles `org:owner/dispatcher/courier`, default courier, no user-created orgs), `useFirm()` auto-activates the membership, and the "No firm yet" screen.
- Who owns what → Data: the tables listed above, the seed (`npm run db:seed`), and the `dev` branch workflow. Remove the health-route sentence.
- Who owns what: replace the "Home data" and "Shift form" bullets with the API routes, `useApi`, `useTodayShift` and `useHomeSummary`, plus autosave.
- Rules: API routes use `requireCourier`-style helpers from `src/server/` (session → firm → role) before any work.
- Commands: `npm run db:seed`.

## Result
Built as planned. `npm run check:api` passes all 28 checks against the dev server (every role, a second firm, validation and locking). Lint, the type check and the salary check pass. The on-phone check is left to the user.

Deviations and findings:
- Clerk: in Git Bash, `clerk api /path` needs `MSYS_NO_PATHCONV=1`, or the path is rewritten into a Windows path and every call returns 404. The roles were created with permission IDs, not keys. The creator and default roles were set through `clerk config patch` (the Backend API's organization_settings PATCH ignored them). `force_organization_selection` was on and was turned off. Org slugs are disabled, so the seed and the check script find firms by name. "Users can create organizations" has no API or config switch, so it has to be turned off in the dashboard.
- Clerk commands used: `clerk enable orgs`, then `POST /organization_roles` for the three roles, `PATCH /role_sets/role_set:default` (default courier, creator owner), `clerk config patch` (`creator_role`, `domains_default_role`, `force_organization_selection: false`, email-domain detection off), `POST /users` ×4, `POST /organizations` ×2, and `POST /organizations/{id}/memberships` ×4.
- `GET /api/shifts/today` also returns `recent` (five shifts before today), so the Shifts screen keeps its recent list.
- The state lives in `src/shifts/today-shift.tsx` (a context shared with the finish sheet), not `src/api/use-today-shift.ts`.
- The schema dropped the extra descending index, because its name clashed with the unique index's auto-generated name. The unique `(firm_id, user_id, date)` index covers both lookups.
- `main` got the schema through `db:push` with main's commented URL. Its values in `.env.local` are quoted, so strip the quotes when reusing them. `main` has tables but no data.
- Test tokens come from `POST /sessions` then `POST /sessions/{id}/tokens` with `organization_id`. They last 60 s, so `check-api.mjs` mints new ones on every run.
