# 24 · Approvals filters and sort

Status: done

## Goal
Dispatchers and owners can narrow the Approvals list (Pending and Reviewed) to one depot, courier or bus, show only shifts with missing photos or corrections, pick Approved or Rejected in Reviewed, and sort by date, courier, depot or bus. The phone remembers the last choice. The look follows the Service log (`src/components/car-notes/service-log.tsx`): a Surface of filter rows that open an `ActionSheet`, then a horizontal chip row.

## Decisions
- Filter and sort (user). Both Approvals tabs, for owners (every depot in the firm) and dispatchers (their depots), not Team (user). Extras (user): a missing-photos chip, a corrected chip, Approved/Rejected chips in Reviewed, and remembered filters.
- Filtering happens on the server, so the 200-row cap applies after filtering and the pick lists are correct. Every filter is added to the `inScope()` condition, so a dispatcher passing a depot, car or courier outside their scope gets an empty list (never 404, never data).
- `GET /api/approvals` query: `view` (as today), `depotId`, `carId` (UUIDs, else `invalid`), `userId` (Clerk ID shape `user_…`, else `invalid`), `photos=missing` (`photoCount` < 8, the existing expected count), `corrected=1`, `status=approved|rejected` (only with `view=reviewed`, else `invalid`), `sort=date|courier|depot|bus` (default `date`).
- Sorting: `date` keeps today's order (Pending: oldest day first; Reviewed: newest review first). `depot` and `bus` sort in SQL by depot name and plate (case-insensitive), then by date. `courier` sorts in memory after names are loaded (locale compare, then date). The cap is still applied in date order first, so with more than 200 matching shifts the courier sort only sorts those 200. Today's data is far below that.
- The answer adds `options: { depots, couriers, buses }`: distinct `{ id, name }`, `{ userId, name }` and `{ id, plate }` over the view's in-scope shifts with no filters applied. One extra `selectDistinct` query. Archived depots and cars with shifts in the view appear too. Lists are sorted by name or plate.
- `pendingCount` (the tab label) stays unfiltered. The answer adds `total`, the filtered count, shown as a footnote ("12 shifts") above the list when any filter is set.
- One filter set is shared by both tabs, except `status`, which applies only to Reviewed. Changing the tab keeps depot, courier, bus, chips and sort.
- Remembered in SecureStore (like `colorScheme`) under `approvalsFilters.<firmId>`, so switching firms never applies another firm's IDs. It is read once when the screen mounts and written when filters change (failures are ignored). Saved IDs that are missing from `options` are dropped once the list loads. Not on web (no SecureStore): filters reset there.
- UI below the SegmentedControl:
  - A Surface with four full-width rows divided by `Divider mx-4`, like the Service log row: `min-h-11`, `px-4 py-3`, `active:bg-secondary-soft`. Each row has a leading icon in `ink-muted`, the value in `body`/`ink`, and a trailing `filter` icon (`sm`, `ink-muted`). Rows: Depot (`depot` icon, "All depots" or the name), Courier (`profile`, "All couriers" or the name), Bus (`car`, "All buses" or the plate, tabular nums), and Sort (`list`, "Sort: Date" / "Sort: Courier" / …). Each opens an `ActionSheet` with "All …" first (Sort lists its four options). Rows are disabled until the first load.
  - A horizontal chip row (`-mx-4`, `gap-2 px-4`, like the Service log). In Reviewed, first come the status chips All / Approved / Rejected, single select with the default `secondary` tone. Then two toggle chips in both tabs: "Missing photos" (`camera` icon) and "Corrected", which use the `primary` tone when on so they read apart from the status group.
  - With any filter set, a "Clear filters" tertiary button sits under the chips. It resets everything except sort.
  - Empty while filtered: `Notice` with icon `filter`, "No matching shifts" and "Try another depot, courier or bus, or clear the filters." Unfiltered empty states stay as they are.
  - Changing a filter reloads the list without the skeleton: the old rows stay until the new answer arrives (quiet reload). `SectionEntrance` doesn't replay.
- No new tokens, icons or dependencies.

## Out of scope
- Team tab filters, date-range filters, free-text search.
- Courier sort over more than the 200 capped rows.
- Remembering filters on web.

## Steps
### 1. API filters
In `src/server/approvals.ts`, add `parseReviewFilters(params: URLSearchParams, view)` → `{ filters } | null` (null = `invalid`). UUIDs are checked with the existing UUID check if there is one (grep `src/domain`), else a small regex in `src/domain/shift.ts`. Change `reviewList(scope, view, filters)`: build extra `SQL[]` (`eq(shifts.depotId)`, `eq(shifts.carId)`, `eq(shifts.userId)`, the status, the corrected condition used by `toShift` for `corrected`, and the photo count < 8 using the same SQL that fills `photoCount` in `selectShifts`). Apply the sort, then `total` (count with filters), then `options` (selectDistinct joined to depots, cars over `inScope(scope, viewCondition)`, names via `userNames`). Update `index+api.ts` to pass the parsed filters. Extend `ApprovalList` in `src/approvals/approvals.tsx` with `total` and `options`. Done when `tsc` passes and the screen still works unchanged.

### 2. Filter state and storage
Add `src/approvals/filters.ts`: the `ApprovalFilters` type, `emptyFilters`, `queryOf(view, filters)` (only set params), `isFiltered`, `useSavedApprovalFilters(firmId)` (SecureStore read/write keyed by firm, try/catch, skipped on web), and `pruneFilters(filters, options)`. `useApprovalList(view, filters)` builds its URL with `queryOf`. Check whether `useResource` keeps old data while a new URL loads; if not, add an opt-in `keepPrevious` so filter changes don't flash the skeleton.

### 3. UI
Add `src/components/approvals/review-filters.tsx` (the Surface of rows, the chip row, Clear filters and four ActionSheets) and use it in `src/app/(app)/approvals/index.tsx` between the header block and the list, plus the total footnote and the filtered empty Notice. Strings under `review.filters.*` in en, bg and de.

### 4. Checks
Extend `scripts/check-approvals.mjs`: as owner, each filter returns only matching shifts and `total` matches; `sort=depot|bus|courier` order is right; the dispatcher with a depot or car outside their depots gets `items: []`; Firm B's owner with Ivanov IDs gets `items: []`; `status` with `view=pending`, a bad UUID, a bad `sort` → 400 `invalid`; a courier gets `role`; `options` for the dispatcher holds only their depots.

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `npm run db:seed` then `npm run check:approvals` (dev server running).
- On the phone as the dispatcher and the owner (Ivanov), in EN, BG and DE, light and dark: pick a depot, courier and bus, toggle Missing photos and Corrected, switch to Reviewed and pick Rejected, try each sort, then clear the filters. Kill and reopen the app: the filters are still set. Use a filter combination with no matches: the filtered Notice appears. Offline while filtered: the error and Retry show and the filters stay.

## AGENTS.md updates
- API section: `GET /api/approvals` takes `depotId`, `carId`, `userId`, `photos=missing`, `corrected=1`, `status` (reviewed only) and `sort`, applied inside `inScope()`, and answers `total` and `options`.
- Shift form / Approvals paragraph: the Approvals filters (Surface rows + chips like the Service log), shared across tabs, remembered per firm in SecureStore (`approvalsFilters.<firmId>`), not on web.

## Result
Built as planned, with three adjustments:
- The pick lists (`options`) cover both views (pending plus the last 30 days reviewed), so switching tabs never prunes a saved depot, courier or bus.
- `useResource` already keeps the old rows while a new URL loads, so it needed no `keepPrevious`.
- The pure parser rules got their own script, `npm run check:review-filters`. The view parsing moved from the route into `parseReviewQuery`, and saved filters are read back through the same parser.
Files: `src/domain/review-filters.ts`, `src/server/approvals.ts`, `src/app/api/approvals/index+api.ts`, `src/approvals/{approvals.tsx,filters.ts}`, `src/auth/{firm,index}.tsx` (`useFirmId`), `src/components/approvals/review-filters.tsx`, `src/app/(app)/approvals/index.tsx`, locales, `scripts/check-approvals.mjs`, `scripts/check-review-filters.mjs`.
