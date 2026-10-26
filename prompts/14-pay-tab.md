# 14 · Pay tab

Status: done

## Goal
Couriers get a real Pay tab: the month's estimated pay and the hours / packages / km tiles move there from Home, with a month switcher to look back. Tapping the pay card or a tile opens a bottom sheet with a small day-by-day table, and tapping a day opens that shift. Separately, a courier fixing a shift that was sent back can no longer change its start and finish times.

## Decisions
- **Home loses the month block.** `MonthSummary` (pay card + 3 tiles) leaves Home entirely; Home keeps the header, Today card, and Recent shifts. `GET /api/home` stops returning `totals` and `rate`.
- **Pay tab = a stack** (`src/app/(app)/pay/`): `index` (the month) and `breakdown` (the sheet). It stays courier-only (the tab is already `hidden` for reviewers).
- **Month switcher:** opens on the current month; ‹ › chevrons and horizontal swipe page months, exactly like the Shifts calendar. Paging back stops at the month of the courier's first shift; forward stops at the current month.
- **One new route:** `GET /api/pay?month=YYYY-MM` (courier only, own data, via `courierContext`). Reviewers get `role`, a bad month gets `invalid`.
- **Tables list approved and submitted shifts**, newest day first. Approved rows count toward the total. Submitted rows show greyed with a "Pending" tag and their value, and don't count. Rejected and draft shifts are left out.
- **Pending pay is never estimated:** a submitted row in the pay table shows "Pending" instead of an amount.
- **Four sheets** (`kind` param): `pay` (day | hours | pay), `hours` (day | hours), `packages` (day | delivered), `km` (day | km driven). Each ends with a total row for approved shifts, matching the card/tile.
- **Hours are decimal everywhere** in the Pay tab ("7,8"), like the tile, so rows add up to the total visibly. Totals are summed from minutes and formatted once, so rounding of rows never changes the total.
- **Rates shown on the pay card:** each rate in force during the month (up to today), one line each — the first as "Hourly · €16.00 / h", later changes as "From 15 Oct: €17.00 / h" — plus the upcoming change for the current month. The pay sheet repeats these lines under the table.
- **Sheets are native form sheets** with detents `[0.5, 1]`, grabber, corner radius 20; swipe down closes. The table scrolls inside the sheet.
- **Row tap opens the shift:** dismiss the sheet, then `router.navigate` to `/shifts/[id]` (the existing read-only / fix screen).
- **Times locked on a sent-back shift:** on the courier's fix screen, Start and Finish are shown read-only (lock icon, no picker) with the hint "Only your dispatcher can change the times." `PATCH /api/shifts/:id` (courier fix) answers `invalid` if the body contains `startTime` or `finishTime`. Dispatcher and owner corrections (`PATCH /api/approvals/:id`) can still change times. Today's draft form is unchanged (the courier sets their own times before submitting).
- **The `time` reject reason is removed.** Couriers can't fix times, so wrong times are fixed by the reviewer with Correct. Reasons become `km`, `packages`, `busOrStation`; a reject with `time` answers `invalid`. No data migration (dev data is re-seeded).
- **No design attached:** built from the existing Home month card, tiles, calendar header, and primitives. No new tokens.

## Out of scope
- Payslips, PDF export, sharing.
- Pay estimates for pending shifts.
- Pay on the Team tab or for reviewers.
- Year view or custom date ranges.
- Changing how pay is calculated (salary math is untouched).

## Design
Every value maps to existing tokens and components.

- **Pay screen** (`/pay`): `ScrollView` `bg-canvas`, `px-4 pb-8 gap-6`, top padding like Home (iOS 8, Android `insets.top + 8`), pull to refresh.
  - **Month header:** the month name (`title`, e.g. "Oktober", with the year when not the current year, via `format.calendarMonth`) on the left; on the right the same back/forward `Chevron` buttons as `CalendarCard` (disabled at the ends). Under it, `footnote` "Approved shifts only". The whole content area is wrapped in the calendar's `Swipe` for month paging.
  - **Pay card:** the current dark card from `MonthSummary` unchanged in look (`rounded-lg bg-inverse p-5 gap-2`: "Estimated pay" `footnote`, amount `display`, caption, rate lines `caption`, pending `Tag`), now wrapped in `PressableScale` with a trailing `chevron` icon (`on-inverse-muted`, `sm`) top-right. `accessibilityRole="button"`, label "Pay per day".
  - **Tiles:** the three `StatTile`s unchanged in look, each wrapped in `PressableScale`, opening `hours`, `packages`, `km`.
  - **Empty month:** card shows the existing "No approved shifts yet" caption; tiles show 0; sheets still open and show the empty state.
- **Breakdown sheet** (`/pay/breakdown?kind=`): `px-4 pt-6`, bottom inset.
  - Title (`title`): "Pay · October", "Hours · October", "Packages · October", "Kilometres · October".
  - Column header row (`footnote` `ink-muted`): "Day" left, then the value columns right-aligned ("Hours", "Pay" / "Hours" / "Delivered" / "km").
  - Rows in a `Surface`, separated by `Divider`, each `px-4 py-3`, ≥ 44 dp, full-width background highlight `secondary-soft` on press: day (`shortDay`, `body` `ink`), values right-aligned (`body` `ink`, tabular numbers via `fontVariant: ["tabular-nums"]` in style). Submitted rows: text `ink-muted` plus a `Tag` "Pending" (`submitted` tone, `sm`) after the day; the pay column shows "–" (the tag already says Pending).
  - Total row below the `Surface` (`label` `ink`): "Total (approved)" and the totals.
  - Pay sheet only: the rate lines under the total (`footnote` `ink-muted`).
  - Empty: "No approved or pending shifts this month" (`body` `ink-muted`, centred).
- **Fix screen, locked times:** the Start/Finish fields render as the same tiles but not pressable, with a `lock` icon (`ink-muted`, `sm`) on the right and values in `ink-muted`; under them a `footnote` `ink-muted` hint.
- **States (Pay screen):** skeleton (card-shaped `bg-border` block + three tile blocks) on first load; error `Alert` + Retry; offline `Alert` + Retry; `role` shows the existing "role not yet" `Notice`. Content fades up on first load only (`SectionEntrance`), not on month paging or refresh. The sheet reads already loaded data, so it has no loading state.

## Steps

### 1. Domain: pay month shape
In `src/domain/types.ts` add:
```ts
export type PayDay = { shiftId: string; date: string; status: "approved" | "submitted";
  minutes: number; packages: number; km: number; payMinor: number | null /* null when submitted */ };
export type PayMonth = { firm: Firm; today: string; month: string; firstMonth: string;
  totals: MonthTotals; rates: Rate[]; next: Rate | null; days: PayDay[] };
```
(`MonthTotals` stays in `salary.ts`; import it as a type.) In `src/domain/salary.ts` add `ratesIn(first, last, schedule): Rate[]` — the rate in force on `first`, then each later day in `[first, last]` where `rateFor` changes, each with `effectiveFrom` = the day it applies. Days with no rate are skipped (only non-null rates are returned). Add `payDays(shifts, schedule): PayDay[]` (approved + submitted, newest first, packages = loaded − returned, km = end − start, pay via `shiftPay` for approved, null for submitted). Extend `scripts/check-salary.mjs` with a month that has a mid-month rate change, a rejected shift, and a submitted shift: `ratesIn` returns both rates, `payDays` excludes the rejected one, approved pays sum to `monthTotals().payMinor`. Done: `node --no-warnings scripts/check-salary.mjs` passes.

### 2. API: `GET /api/pay`
New `src/app/api/pay+api.ts`: `courierContext` → `monthParam` (`invalid` on bad month) → in parallel `shiftsBetween(courier, ...monthRange(month))`, `firstShiftDate(courier)`, `payScheduleOf(courier.firmId, courier.userId)`. Return `PayMonth`: `firstMonth` computed like `calendarMonth` (extract that bit into a small exported helper in `src/server/calendar.ts` and reuse it), `totals = monthTotals(shifts, schedule)`, `rates = ratesIn(first, min(last, today), schedule)`, `next = month === current ? nextRate(today, schedule) : null`, `days = payDays(shifts, schedule)`. No logging of amounts. Add `scripts/check-pay.mjs` and `"check:pay"` in `package.json` (same style as `check-calendar.mjs`, seeded data): courier.a gets own current and previous month; dispatcher and owner get `role`; `month=2026-13` → `invalid`; courier.b (Firm B) sees only own shifts (no Ivanov shift ids); approved `payMinor` sum equals `totals.payMinor`; no rejected shift appears; submitted rows have `payMinor: null`.

### 3. Remove the month block from Home
`src/app/api/home+api.ts`: drop `shiftsBetween` month query, `payScheduleOf`, `totals`, and `rate` from the response. `src/home/use-home-summary.ts`: drop `totals` and `rate` from `HomeData`. `src/app/(app)/home.tsx`: remove `MonthSummary` and shift the `SectionEntrance` indexes. Move `src/components/home/month-summary.tsx` to `src/components/pay/month-summary.tsx` (it will become the Pay screen's card + tiles in step 5). Update `home-skeleton.tsx` to drop the month placeholder. Check `check:api` still passes (adjust any assertion on `totals`/`rate` in `/api/home` to the new shape). Done: Home shows header, Today, Recent; tsc and lint pass.

### 4. Pay data hook
Loosen `useCalendar`'s constraint in `src/calendar/use-calendar.ts` from `T extends CalendarMonth` to `T extends { month: string; today: string; firstMonth: string }` so it serves any paged month. New `src/pay/pay-month.tsx`: `PayMonthProvider` + `usePayMonth()` wrapping `useCalendar<PayMonth>("/api/pay")`, so the Pay screen and the breakdown sheet share one state (like `TodayShiftProvider`). Add `refresh` for pull-to-refresh (reuses `retry`, keeping data on screen).

### 5. Pay screen
Replace `src/app/(app)/pay.tsx` with `src/app/(app)/pay/_layout.tsx` (Stack inside `PayMonthProvider`, `index` headerless, `breakdown` as `formSheet` with `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible`, `sheetCornerRadius: 20`) and `src/app/(app)/pay/index.tsx` per the Design section. Export `Swipe` and `Chevron` from `calendar-card.tsx` if they aren't already, and reuse them. Rework `src/components/pay/month-summary.tsx`: takes `PayMonth` and the format, renders the month header, pressable card and tiles, and `onOpen(kind)`. Rate lines: current month → current + next as today; past month → one line per entry in `rates` (first without a date, later ones "From {date}: …"). Remove `TabPlaceholder` usage for pay and the `placeholder.pay.*` strings if nothing else uses them.

### 6. Breakdown sheet
`src/app/(app)/pay/breakdown.tsx` + `src/components/pay/breakdown-table.tsx` per the Design section, reading `usePayMonth()` and `kind` (unknown kind → `router.back()`). Row press: `router.back()` then `router.navigate({ pathname: "/shifts/[id]", params: { id } })`. Totals come from `PayMonth.totals`, not from summing rows on the client.

### 7. Lock times on the courier's fix
`src/components/shifts/shift-edit-form.tsx`: add `lockTimes?: boolean`; when set, Start/Finish render read-only per the Design section with the hint. `src/app/(app)/shifts/[id].tsx`: pass `lockTimes`. `correctionOf` already omits unchanged fields, so no time is sent. `src/app/api/shifts/[id]+api.ts` PATCH: after `parseCorrection`, answer `invalid` when `edit.value.startTime !== undefined || edit.value.finishTime !== undefined`. Add to `scripts/check-approvals.mjs` (it already rejects shifts and fixes them as the courier): a courier fix with `startTime` → 400 `invalid`, and the shift's times unchanged; a fix with only `loaded` still works; a dispatcher correction of `startTime` still works.

### 8. Remove the `time` reject reason
`src/domain/types.ts`: `RejectReason = "km" | "packages" | "busOrStation"`. `src/domain/shift.ts`: drop `"time"` from `rejectReasons` (the reject sheet and the server parser both read it). Remove `review.reasons.time` from the three locales. `scripts/check-approvals.mjs`: reject with `["km"]`, and add "reject with `time` → 400".

### 9. Translations
All new strings in `en.json`, `bg.json`, `de.json`: `pay.title.*` (pay/hours/packages/km with `{{month}}`), column headers, `pay.total`, `pay.pending`, `pay.empty`, `pay.rateFrom`, `pay.openDay` (a11y), `pay.error`, `pay.offline`, `shifts.fix.timesLocked`. Move the `home.month.*` keys still used by the card to `pay.month.*`, and delete unused ones.

## Verification
- `npx tsc --noEmit` and `npx expo lint` pass.
- `node --no-warnings scripts/check-salary.mjs` passes (hand-calculated month with a mid-month rate change, a rejected shift, and a pending shift).
- With the dev server running and after `npm run db:seed`: `npm run check:pay`, `npm run check:approvals`, `npm run check:api`, `npm run check:calendar`, `npm run check:pay-rates` all pass.
- On the user's phone (they run Metro and reload), as courier.a in German and Bulgarian:
  - Home shows no pay card or tiles.
  - Pay tab: October card and tiles match what Home showed before; ‹ goes to September, › is disabled on October; swipe pages too.
  - Tap each tile and the card: the sheet opens at half height, drags to full, rows add up to the total, pending rows are grey with "Pending", rejected days are missing; tapping a row opens that shift in the Shifts tab.
  - Airplane mode on the Pay tab → offline alert with Retry.
  - As dispatcher, reject a shift; as courier.a open it: Start/Finish are locked with the hint, other fields editable, resubmit works.
- As dispatcher/owner the Pay tab stays hidden.

## AGENTS.md updates
- **API:** add `GET /api/pay?month=` (courier: approved + pending days, totals, rates in force that month, next change). Replace "`GET /api/home` also returns the courier's own `rate`" — Home no longer returns totals or rate.
- **Home data / Shift form section:** Home = header, Today, Recent shifts. Pay tab (`src/app/(app)/pay/`) uses `usePayMonth()` from `src/pay/`; tiles and the pay card open the `breakdown` form sheet (`kind` = pay | hours | packages | km); `useCalendar` serves any paged month.
- **Domain → Shift:** "The courier edits a shift only while it is `draft` or `rejected`; when fixing a rejected shift they can't change its start or finish time (only reviewers correct times); resubmitting keeps its times." (Replaces the current sentence.)
- **Domain → Shift:** reject reason codes are `km`, `packages`, `busOrStation` (no `time`).
- **Commands:** add `npm run check:pay`.

## Result
Built as planned, with these differences:
- Rate lines list every rate in force during the month for current and past months alike (simpler and consistent), plus the upcoming change for the current month.
- A pending row's pay column shows "–" rather than repeating "Pending" next to its tag.
- Locked time fields keep the normal value color (`TextField` with `editable={false}`), with the lock icon and hint as the cue.
- `CourierRate`, `TabPlaceholder` and the `placeholder.pay.*` / `home.month.*` strings were removed (no longer used); `firstMonthOf` was split out of `calendarMonth` in `src/server/calendar.ts`.
- Verified: tsc, lint, check-salary, and check:pay / api / approvals / calendar / pay-rates against the running dev server. Not verified on device yet (no simulator on this machine; the user tests on their phone).
