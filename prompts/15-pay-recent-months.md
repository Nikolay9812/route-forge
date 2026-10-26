# 15 · Recent months on the Pay tab

Status: done

## Goal
Below the tiles on the Pay tab, couriers see their last 5 months, like Home's recent shifts list: each month's pay and approved hours. Tapping a month shows it in the card and tiles above.

## Decisions
- **Which months:** the 5 months before the current month, newest first, whatever month is shown above. Months before the courier's first month (`firstMonth`) are left out, so a new courier sees fewer rows, and none hides the section.
- **Row:** month name (`format.calendarMonth`, with the year when not the current year) as `label`; under it `footnote` "152,3 h · 21 shifts" ("1 shift" singular); pay on the right as `label`. Approved shifts only, same rules as the card.
- **Tap:** the card and tiles switch to that month (like paging with ‹) and the screen scrolls to the top.
- **Data:** `GET /api/pay` also returns `recentMonths: { month, payMinor, approvedMinutes, approvedShifts }[]`, the same in every month's answer. The client reads it from the newest answer (`latest`), so it doesn't change while paging. Computed from approved shifts with `monthTotals`, never stored.
- **Look:** a copy of `RecentShifts` (title row with `title` "Recent months", `Surface` with `Divider`s, rows `min-h-14 px-4 py-3`, `active:bg-canvas`), no "See all" button. Fades in with the rest of the screen on first load only. No new tokens.

## Out of scope
- Year view, more than 5 months, a "See all" screen.

## Steps
### 1. Domain + API
`src/domain/types.ts`: `MonthPay = { month: string; payMinor: number; approvedMinutes: number; approvedShifts: number }` and `recentMonths: MonthPay[]` on `PayMonth`. `src/app/api/pay+api.ts`: one more query, `shiftsBetween(courier, firstDay(current − 5), lastDay(current − 1))`, grouped by month; for each of those 5 months ≥ `firstMonth`, newest first, `monthTotals(monthShifts, schedule)`. Extend `scripts/check-pay.mjs`: 5 rows for courier.a (seed starts 6 months back), newest first, months before the current one only, and last month's row equals last month's `totals`.

### 2. Paging to a month
`src/calendar/use-calendar.ts`: add `goTo(month)` (ignored outside `firstMonth`…current).

### 3. UI
`src/components/pay/recent-months.tsx` per Decisions; `src/app/(app)/pay/index.tsx` renders it under `MonthSummary` when `latest.recentMonths` isn't empty; on press `goTo(month)` and scroll the `ScrollView` to the top. Strings `pay.recent.title`, `pay.recent.summaryOne`, `pay.recent.summaryOther`, `pay.recent.open` (a11y) in en, bg, de.

## Verification
- tsc, lint, `check:pay` (after db:seed) and `check-salary` pass.
- On the phone as courier.a: under the tiles, September back to May with pay and hours; tapping August shows August above and scrolls up; September's row matches September's card.

## AGENTS.md updates
API line for `GET /api/pay` gains "the 5 months before the current one (pay, hours, shifts)"; Pay tab line gains the recent months list.

## Result
Built as planned. Verified with tsc, lint, check-salary and `check:pay` (23/23 after db:seed). Not yet checked on the phone.
