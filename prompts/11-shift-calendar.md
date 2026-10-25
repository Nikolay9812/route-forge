# 11 · Shift calendar and team

Status: done

## Goal
Couriers see a month calendar of their shifts under today's shift form on the Shifts tab. They can page back through past months, switch the card to a list, and tap a day to open that shift. Dispatchers and owners get a new **Team** tab: a list of the couriers they may see. Tapping a courier opens the same calendar for that person, and tapping a day opens the existing review detail (approve, reject, correct). The seed gains six months of older, realistic shifts to test with.

## Decisions
- **Courier placement:** the Shifts tab, below today's form (or below the submitted card). No new courier tab.
- **Day marks by status:** approved = filled `secondary-ink` circle with `on-inverse` number (`white` in dark mode, see Design). Submitted = filled `primary` with `on-primary`. Rejected = filled `danger` with `white`. Draft = `secondary-ink` 2 px outline. Today with no shift also gets the outline, so the courier can always find today. A one-line legend sits under the grid.
- **Stats row:** Shifts (every shift in the month, any status) · Hours (minutes of submitted and approved shifts) · Approved (approved minutes only). Hours are shown as `h:mm` with no day cap ("109:25"), like the design. No pay on this screen.
- **Tap a day:** couriers open `/shifts/[id]` (the existing screen, fixable when rejected). Reviewers open the review detail inside the Team stack (`/team/shift/[id]`), so Back returns to the calendar. Days without a shift do nothing.
- **Liste:** the header link toggles the same card between the calendar and a list of that month's shifts (day, hours, status tag, oldest first). The link reads "List" in calendar mode and "Calendar" in list mode. The mode stays the same when paging months.
- **Months:** the chevrons and a horizontal swipe change the month. Paging goes back to the month of the first shift visible to the viewer, and never forward past the current month (the firm's timezone). The chevron at either limit is disabled. The 5 dots stand for the last 5 months, with the newest on the right, and the shown month's dot is filled. On older months no dot is filled.
- **Status line** (the design's "Alle Schichten bestätigt") is a small card above the calendar card, about the shown month: "N shifts need fixing" if any are rejected, else "N waiting for approval" if any are submitted, else "All shifts approved". It is hidden when the month has no shifts.
- **Team tab:** reviewers' tabs become Approvals, Team, Profile. Owners see every `org:courier` member of the firm, plus anyone else with shifts in the firm (for example a courier who left). Dispatchers see only couriers with at least one shift in their depots, and each calendar shows only shifts in those depots. Asking for a courier outside scope answers 404.
- **Team rows:** initials, name, and this month's "N shifts · h:mm", plus a "N waiting" tag when shifts are submitted. Sorted by name. No search (see Out of scope).
- **Week starts on Monday** in all three languages. Weekday initials and month names come from `Intl` in the app language. All dates use the firm's timezone.
- **Data fetch:** one request per shown month. The month just left stays in memory, so paging back and forth doesn't refetch. Content fades in only on first load, never on paging or tab return.
- **Seed:** 6 full past months plus the current month up to yesterday, for every courier. Details are in step 1.

## Out of scope
- The design's top bar (menu, firm name, chat icon) and the "Veranstaltungen" (events) card.
- Searching or filtering the Team list, and inviting or archiving users from it.
- Pay on the calendar or the Team list (the Pay tab stays the place for money).
- Future months, planned shifts, and days off as data.
- A calendar for the reviewer's own shifts (reviewers don't log shifts).

## Design
Measured from the attached screenshot (1080 px wide, about 411 dp, so 1 dp ≈ 2.63 px). All of these values are estimates from the image and are mapped to existing tokens. **No new color, radius or type tokens.**

- **Status card:** `Surface` (surface, border, `rounded-lg`), `py-4 px-4`, centred `body` text in `ink-muted`.
- **Calendar card:** `Surface`, `rounded-lg`, no inner padding. It has three sections separated by the full-width `Divider`:
  1. **Header**, `px-4 py-4`, as a row: icon `review` (new registry entry: iOS `doc.text.magnifyingglass`, Android `find_in_page`), size `md`, `ink`. Then a `gap-3` and the month name in `title` (`ink`). On the right, the link ("List"/"Calendar") in `body` with color `secondary-ink`. The link is a pressable with a 44 dp hit area.
  2. **Stats**, `px-4 py-4`: three equal columns, `gap-1` each. The label is `body` `ink`. The value is `body` `ink` with tabular figures.
  3. **Grid**, `px-4 pt-4 pb-4`:
     - A weekday header row of 7 equal columns, centred `body` `ink-muted`, `pb-3`.
     - Week rows with `gap-3` between them. Each row is a 7-cell row with a `border` border and `rounded-md`, `overflow-hidden`. Cells are separated by 1 dp `border` lines and are `h-13` (52 dp) high.
     - Days outside the month have a `canvas` background and an `ink-muted` number. Days in the month have a `surface` background and an `ink` number, in `body`.
     - The day mark is a `size-8` (32 dp) circle, `rounded-full`, centred, with the number inside.
     - Under the grid: a legend row (`footnote` `ink-muted`, a `size-2.5` dot per status), `pt-3`.
     - The pager row, `pt-6`: a `back` chevron, the 5 dots, then a `chevron`. The chevrons are `IconButton`-sized ghost hit areas (44 dp) with icon color `ink`, and `ink-muted` at 40% opacity when disabled. The dots are `size-2.5` with `gap-2`: `secondary-ink` when filled, `border` otherwise.
- **List mode:** this replaces section 3. The rows are full-width pressables, `px-4 py-3`, separated by `Divider`, and highlight their background (`secondary-soft`) on press. A row shows `shortDay` in `body`, then `h:mm` in `body` `ink-muted`, then a status `Tag` on the right. A month without shifts shows "No shifts this month" in `body` `ink-muted`, centred, `py-8`.
- **Dark mode:** the approved circle uses `secondary-ink` (light navy in dark mode) with the number in `on-inverse`, which resolves to dark text, so contrast holds both ways. Rejected uses `danger` with `white`.
- **Motion:** a month change cross-fades the grid (opacity 0 → 1, 180 ms, the house curve). It never slides, so reduced motion needs no special case. Swipe uses `Gesture.Fling` (left = next, right = previous) from react-native-gesture-handler, which is already installed. Day circles and the list use plain highlight feedback, not `PressableScale` (they're cells, not cards). Team rows highlight their background.
- **Team list:** a `heading` "Team", then rows inside a `Surface`: a `size-10` `rounded-full` `secondary-soft` initials badge (`label` `secondary-ink`), then the name (`body` `ink`) over "N shifts · h:mm" (`footnote` `ink-muted`), then a `Tag` "N waiting" (warning tone, as in Approvals) and a `chevron`. The `[userId]` screen has a native header titled with the courier's name, then the status card and the calendar card.
- **States** (both calendars and the Team list): a skeleton while loading (grey blocks the size of the cards), an `Alert` with Retry on error, the offline `Alert` when offline, and empty texts ("No shifts this month", "No couriers yet").

## Steps

### 1. Seed: six months of history
Edit `scripts/seed.mjs`:
- Find couriers by their Clerk identifier (`public_user_data.identifier`), not by list position. Clerk's order isn't stable (see plan 10's Result).
- **Rates** for every courier: €14.00 from the 1st of the first seeded month, €14.50 from the 15th three months ago, €15.00 from the 1st of the current month, €16.00 from the 15th of the current month. Firm B: €12.00 from the first seeded month.
- **Days:** from the 1st of the month 6 months before the current one, up to yesterday. Use weekdays, minus about 1 in 7 days off. Every other Saturday is a shift. Use a deterministic PRNG keyed by courier and date, so reruns give the same calendar.
- **Depots:** courier.a alternates HBW3 and HBW1. courier.c works only at HBW7, so the dispatcher sees neither courier.c nor their calendar. Other couriers rotate as now. Cars follow the depot.
- **Statuses:**
  - The current month keeps today's pattern: the newest two weekdays submitted, the 4th rejected, the rest approved. `check:approvals` makes its own shifts and doesn't depend on this.
  - Last month: one rejected shift (reason `packages`) and one shift left submitted.
  - Older months: all approved.
  - Two older shifts per courier get a correction: an `end_km` change with a matching `shift_changes` row by the reviewer, so they show "Corrected".
- **Times:** starts between 05:45 and 07:30 (Europe/Berlin), working time 6:30–9:45, km, loaded and returned as now. The odometer stays monotonic per car.
- Keep printing counts only, never pay.

Done when `npm run db:seed` prints about 140 shifts per Ivanov courier, and a SQL spot check shows 7 distinct months, courier.c only at HBW7, and rejected or submitted shifts in last month.

### 2. Domain: month grid and stats
Add `src/domain/calendar.ts`. It is pure, with only type imports (it must run in Node like `salary.ts`), and holds:
- `monthGrid(month: "YYYY-MM")`: weeks (Monday-first) of `{ date, inMonth }`, padded with days of the neighbouring months to full weeks.
- `addMonths(month, n)`.
- `monthsBetween(from, to)`.
- `monthStats(shifts)`: `{ shifts, minutes, approvedMinutes, submitted, rejected }`, where `minutes` counts submitted and approved.
- `isMonth(text)`, which validates the `month` query parameter.

Add the type `CalendarMonth = { firm: Firm; today: string; month: string; firstMonth: string; shifts: Shift[]; stats: MonthStats }` to `src/domain/types.ts`.

Done when a short `node --no-warnings` one-off (not committed) prints the grid for 2026-10, starting Mon 28 Sep and ending Sun 1 Nov as in the design, and `tsc` passes.

### 3. Courier API: `GET /api/calendar?month=YYYY-MM`
Add `src/app/api/calendar+api.ts`:
- `courierContext`, then validate `month` with `isMonth` (`invalid` otherwise; it defaults to the current month).
- Use `shiftsBetween(courier, first, last)` for the month.
- Add `firstShiftDate(courier)` to `src/server/shifts.ts` (min `date` through `mine()`). `firstMonth` = the month of that date, or the current month when there are none.
- Return `CalendarMonth`.

Done when the route answers a courier with their month, and answers a dispatcher or owner with `role`.

### 4. Reviewer API: `GET /api/team` and `GET /api/team/:userId?month=`
In `src/server/team.ts`, every query goes through `inScope()`, which is exported from `src/server/approvals.ts` without changes to its logic:
- `teamList(scope, today)`:
  - Owners: `org:courier` memberships from Clerk (`clerk.organizations.getOrganizationMembershipList`, all pages, in a new helper `firmCouriers(firmId)` in `src/server/auth.ts`) ∪ distinct `user_id`s with shifts in the firm.
  - Dispatchers: distinct `user_id`s with shifts in scope.
  - For each courier: this month's count, minutes (submitted and approved) and submitted count, from one grouped query in scope. Names come from `userNames()`. Sort by name.
- `courierMonth(scope, userId, month)`: null (→ 404) when the user isn't in the team list rules above. Otherwise the in-scope shifts of that month, the in-scope first shift month, and stats, plus `courierName`.

Routes: `src/app/api/team/index+api.ts` and `src/app/api/team/[userId]+api.ts`, both behind `reviewerContext`. Couriers get `role`.

Done when the owner gets courier.a and courier.c, the dispatcher gets courier.a only, and the dispatcher asking for courier.c gets 404.

### 5. Calendar UI
Shared component `src/components/calendar/` holds:
- `calendar-card.tsx`: the header, stats, grid or list, legend and pager, per Design.
- `status-line.tsx`.
- `calendar-skeleton.tsx`.

The hook `src/calendar/use-calendar.ts` takes a `path` builder (`(month) => string`). It returns `{ month, data, status, next(), prev(), retry() }`, keeps a per-month cache in a `Map`, and reloads the shown month quietly on screen focus (after the first focus), like approvals.

The card takes `onOpenShift(id)`. Add the icon `review` (and `team`: iOS `person.2`, Android `group`) to `src/components/icons.ts`. Add the strings under `calendar.*` and `team.*` in en, bg and de, including the legend, stats labels, list/calendar link, status lines with plurals, empties and errors.

Done when the card renders against the API in both modes, light and dark.

### 6. Courier: calendar on the Shifts tab
In `src/app/(app)/shifts/index.tsx`, render `StatusLine` and `CalendarCard` below the today content, with `useCalendar((m) => `/api/calendar?month=${m}`)`, opening `/shifts/[id]`. After a submit or resubmit, the current month reloads, so today's mark changes to submitted. The calendar's own loading and error states are independent of the today form.

Done when a seeded courier pages back 6 months, opens a rejected shift from last month, fixes it, comes back, and sees it amber.

### 7. Reviewer: Team tab
- Add `team` to the tabs in `src/app/(app)/_layout.tsx` (`for: "reviewer"`, icon `team`, label `tabs.team`).
- Add `src/app/(app)/team/_layout.tsx`, a Stack wrapped in `ApprovalsProvider`. Its screens:
  - `index` (the list, no header).
  - `[userId]` (native header with the courier's name, back title "Team").
  - `shift/[id]` (the review detail).
  - `shift/reject` (formSheet like approvals).
- Move the bodies of `approvals/[id].tsx` and `approvals/reject.tsx` into `src/components/approvals/review-detail-screen.tsx` and `review-reject-screen.tsx`. They take a `rejectPath` param, so the existing approvals routes and the new team routes are thin wrappers, with no behaviour change in Approvals.
- A decision made in the detail bumps the provider revision, so the courier calendar under it reloads.

Done when the owner opens courier.c's calendar, opens a submitted day, approves it, goes back, and sees the day blue.

### 8. Checks script
Add `scripts/check-calendar.mjs` and `npm run check:calendar`, using `scripts/lib/api-test.mjs`. It runs against the dev server and the seeded `dev` branch:
- Courier `/api/calendar`: own shifts only, the right month, `firstMonth` 6 months back, `invalid` for `month=2026-13` and `month=abc`, and no other courier's IDs.
- Courier → `/api/team` → 403 `role`.
- Firm B courier: only firm B data.
- Dispatcher `/api/team`: has courier.a, lacks courier.c. `/api/team/<courier.c>` → 404. courier.a's months contain only HBW3/HBW1.
- Owner `/api/team`: has courier.a and courier.c, and lacks courier.b (firm B). `/api/team/<courier.b>` → 404.
- Stats equal a hand count for one seeded month.

## Verification
1. `npx expo lint` and `npx tsc --noEmit` pass.
2. `npm run db:seed`, then `npm run check:calendar`, `npm run check:approvals` and `npm run check:api` all pass. They need the dev server running.
3. `node --no-warnings scripts/check-salary.mjs` passes. Salary code isn't touched, but the seed's rates change.
4. On the Samsung (the user runs Metro; the app is never started by me):
   - **courier.a:** the Shifts tab shows the calendar under today. Last month has red and amber days, older months are all blue, and paging stops at 6 months back and at the current month. Swipe works, List mode works, and tapping a day opens it.
   - **dispatcher:** the Team tab lists courier.a without courier.c. Their calendar shows only HBW3/HBW1 shifts, and approving from it updates the day.
   - **owner:** sees courier.c too.
   - Bulgarian and German texts fit. Dark mode is readable. Airplane mode shows the offline alert while today's typed values stay.
5. Compare the calendar card with the design and list the differences. All sizes are estimates from the screenshot (see Design).

## AGENTS.md updates
- **(app) tabs:** "Tabs depend on the role: couriers get Home, Shifts, Pay, Profile; dispatchers and owners get Approvals, Team, Profile." This replaces the current sentence.
- **API:** add the courier route `GET /api/calendar?month=`. Add the reviewer routes `GET /api/team` (owners: every courier in the firm; dispatchers: couriers with shifts in their depots) and `GET /api/team/:userId?month=` (out of scope → 404).
- **Shift form** line: the Shifts tab also holds the month calendar (`src/components/calendar/`, `useCalendar`), shared with Team.
- **Domain:** add `calendar.ts` (month grid, Monday-first, and month stats) to the `src/domain/` list.
- **Commands:** add `npm run check:calendar`. Update the `db:seed` description to "six months of shifts".

## Result
Built as planned. `check:calendar` passes 30/30, `check:approvals` and `check:api` pass, and lint, the type check and the salary check pass. The `dev` branch is seeded with 2026-04-01 to yesterday (about 140 shifts per courier). The device check on the Samsung is still open.

Deviations:
- **Recent shifts on the Shifts tab:** the calendar replaced this list. Its "See all" did nothing, and the calendar's List mode covers it. Home keeps its own recent list.
- **Swipe:** uses core `PanResponder` instead of gesture-handler's `Gesture.Fling`. The app has no `GestureHandlerRootView`, and adding one would mean changing the root layout.
- **Year in the header:** a month outside the current year shows its year ("Dezember 2025").
- **German stats labels:** "Schichten · Arbeitszeit · Genehmigt". The design's "Gesamt Stunden" would wrongly suggest all hours.
- **Counts without plurals:** the i18n key types have no plural forms, so counts read "Waiting: 2".
- **check-approvals:** it now reads the expected rate from the database. Its target can come from last month, which now has an older rate.
