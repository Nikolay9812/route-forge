# 22 · Firm settings, automatic breaks and Spesen

Status: done

## Goal
Owners get a Firm settings screen in Profile: currency and timezone (editable until the first shift), plus dated rules for the automatic break and Spesen (tax-free meal allowance). Shift hours lose the break automatically, couriers earn Spesen on long shifts, and hours read the same way (`7:15 h`) everywhere in the app.

## Decisions
- **Break, full law rule (ArbZG §4) by default:** a shift (finish − start) over 6:00 h loses 30 min, over 9:00 h loses 45 min in total. "Over" is strict: exactly 6:00 h has no break. No cap: 6:10 h pays 5:40 h. Nobody types a break.
- **Spesen by default:** €14.00 per approved shift whose shift time (before the break) is over 8:00 h. Every courier gets it, hourly and day rate alike. It's never part of the salary math and is shown separately as tax-free.
- **Rules are firm data, not code.** Each firm has dated rule entries (`firm_rules`) holding both thresholds and both break lengths, the Spesen threshold and the Spesen amount (0 = no Spesen). The owner edits them in Firm settings. Seeded firms start with the German defaults.
- **Rule changes start on a date**, just like pay rates. On a given day the latest entry on or before it applies. With no entry there's no break and no Spesen. Past start dates are allowed after a warning (they change approved hours and pay). Only upcoming entries can be edited or cancelled. One entry per firm per day (`taken`). Each entry records who set it and when.
- **Break and Spesen are always computed, never stored**, so corrected times update them automatically.
- **Hours on a shift:** `minutes` stays the shift time (finish − start). Each `Shift` also carries `breakMinutes` and `workedMinutes` (= minutes − break), computed on the server from the rule in force on the shift's day. Hourly pay, month hours, calendar and Pay hours all use `workedMinutes`. An in-progress shift shows elapsed time with no break.
- **Who sees Spesen:** the courier (own, on Pay) and reviewers in review detail (it's shift pay, like now). Team stays pay-free, and so does Spesen.
- **Pay card:** the large number stays the salary. Under it, a line "+ €28.00 Spesen (tax-free)" appears when the month has Spesen. The breakdown sheet's pay table gets a Spesen column.
- **Currency and timezone:** owners only. Editable while the firm has no shifts, locked after (the server answers `notEditable`). When a firm has no settings row yet, the screen creates one (defaults EUR, Europe/Berlin). Currencies come from a fixed list in `src/domain/firm.ts`, all with two minor digits: EUR, CHF, PLN, CZK, GBP. Timezones come from a fixed list of European zones (Europe/Berlin, Vienna, Zurich, Sofia, Bucharest, Warsaw, Prague, Amsterdam, Brussels, Paris, Madrid, Rome, London). The name stays in Clerk and is shown read-only.
- **One hours format:** `H:MM h` (`7:15 h`, `117:00 h`) in every screen and language. Metric tiles whose caption already says "hours" show `7:15` without the trailing `h`. Decimal hours (`hours`, `hoursTenths`) and `duration` go away.
- **No design attached.** Built from the Pay rates screens and existing primitives, with no new tokens. One new icon (`settings`: SF `gearshape`, Material `settings`) if the registry lacks one.

## Out of scope
- Spesen for 24 h absences, overnight trips, or meal deductions (Kürzung) when the firm provides food.
- Breaks the courier actually took (start/stop break buttons), and per-shift break overrides by reviewers.
- Overtime, night or Sunday surcharges.
- Payroll export / Lohnabrechnung.
- Editing the firm name or logo (still Clerk).

## Design
- **Profile (owners):** a "Firm settings" row (`settings` icon) first in the "Firm" `Surface`, above Depots & cars, with the same row styling.
- **Firm settings** (`/profile/firm`), styled like Pay rates (`ScrollView` `bg-canvas` `px-4` `gap-4`):
  - Label "General", then a `Surface` with rows: Name (value in `ink-muted`, not pressable), Currency, Timezone. While unlocked, Currency and Timezone open an `ActionSheet` of the list and save right away. When locked, each shows its value with a `lock` icon, and a `footnote` `ink-muted` under the Surface reads "Currency and timezone are locked once the firm has shifts."
  - Label "Breaks & Spesen", then a `Surface` `p-5` with the current rule: "Break" `label` + "30 min after 6:00 h · 45 min after 9:00 h" (`body`), "Spesen" `label` + "€14.00 when a shift is over 8:00 h" or "Off". There's an "Upcoming change" `Tag` (`info`) when one exists, or "Not set" with a `warning` `Alert` when there's no rule at all.
  - A `Button` "Schedule a change" (`secondary`) opens the rules sheet.
  - Label "History": entries newest first, like the rate history (start date, short summary, "Set by … · date", `Upcoming`/`Current` tags; upcoming rows open the sheet in edit mode).
- **Rules sheet** (`/profile/rules-change?id=`), using the `FleetSheet` shell: title "New rules" / "Edit upcoming rules". Fields: "Break after" (`H:MM` text field) + "Break" (`Stepper`, 15-min steps), "Longer break after" + "Longer break"; a `Toggle` "Pay Spesen" showing "Spesen after" (`H:MM`) and "Amount" (decimal, `parseAmount`); "Starts on" `DateField` (default: the 1st of next month); the past-date warning `Alert` and a confirm `ActionSheet`; "Save"; and in edit mode "Cancel this change". Errors: `taken` under the date, `invalid` under the field, offline keeps the input.
- **Review detail pay card:** "9:30 h − 0:45 h break = 8:45 h × €16.00", or "Day rate". A "Spesen €14.00" row appears when the shift has Spesen.
- **Shift detail / submitted card:** hours show worked time, with a `footnote` "incl. 0:45 h break deducted" when there's a break.
- **States:** a skeleton, error with Retry, offline, and a first-load fade-up, as on Pay rates.

## Steps

### 1. Domain: work-time rules and one hours format
- `src/domain/types.ts`: `WorkRule = { effectiveFrom; breakAfterMinutes; breakMinutes; longBreakAfterMinutes; longBreakMinutes; spesenAfterMinutes; spesenMinor }`. Add `breakMinutes` and `workedMinutes` to `Shift`; `spesenMinor` to `MonthTotals` and `PayDay` (null unless approved); `workedMinutes`/`breakMinutes` to `PayDay`. Owner view types `FirmRuleEntry` (+ `id`, `upcoming`, `current`, `setByName`, `setAt`) and `FirmSettingsView = { today; name; currency; timeZone; locked; rule: WorkRule | null; next: WorkRule | null; entries: FirmRuleEntry[] }`.
- New `src/domain/work-time.ts` (pure, type imports only): `ruleFor(date, rules)`, `breakFor(minutes, rule)`, `workedMinutes(minutes, rule)`, `spesenFor(minutes, rule)` (shift time, not worked time), `parseRule(input)` (whole minutes; `longBreakAfter > breakAfter`, `longBreak ≥ break`, breaks 0–120, thresholds 1:00–16:00, Spesen 0–100.00), `LAW_DEFAULTS`.
- New `src/domain/firm.ts`: `CURRENCIES`, `TIME_ZONES`.
- `src/domain/salary.ts`: hourly pay uses `workedMinutes`; `monthTotals.approvedMinutes` sums worked minutes; add `spesenMinor` per approved shift. `shiftPay` signature unchanged (the shift already carries `workedMinutes`). Spesen needs the rule, so `monthTotals`/`payDays` take `rules: WorkRule[]` as a new argument.
- `src/components/home/format.ts`: one `hours(minutes)` → `"7:15 h"` via a new `units.hours` = `"{{time}} h"`, plus `clock(minutes)` → `"7:15"` for tiles. Remove `duration`, `hoursTenths` and the decimal `hours`, then fix every caller (Home recent shifts, shift summary, submitted card, calendar card, Pay summary/tiles/recent months/breakdown table, review list and cards). Update the en/bg/de strings that embed hours (`pay.month.approvedHours`, `pay.recent.summary*`, `review.payBreakdown`, `team` summary).
- `scripts/check-work-time.mjs` + `npm run check:work-time`: thresholds at 6:00/6:01/9:00/9:01/8:00/8:01, rule resolution by date, `parseRule` rejects. Extend `scripts/check-salary.mjs` with the hand example below.

Done when tsc, lint and both pure checks pass and the app shows `H:MM h` everywhere.

### 2. Schema and seed
- `src/db/schema.ts`: `firm_rules` (`id`, `firm_id`, `effective_from` date, the six integer fields, `set_by`, `set_at`, `created_at`; unique `(firm_id, effective_from)`; checks matching `parseRule`).
- `scripts/seed.mjs`: both firms get one `LAW_DEFAULTS` entry starting on the first seeded day. Make sure some seeded shifts are over 6, 8 and 9 h.
- `npm run db:push` (dev branch), then `npm run db:seed`.

### 3. Server: rules in every shift and pay answer
- `src/server/firm.ts`: `loadRules(firmId)`, `hasShifts(firmId)`.
- `src/server/shifts.ts`: the shift mapper takes the firm's rules and fills `breakMinutes`/`workedMinutes`. Every caller (courier, home, calendar, pay, approvals, team) loads the rules once per request.
- `/api/pay`: totals and days carry worked minutes and Spesen; recent months use worked hours. `/api/approvals/:id`: the pay part carries `breakMinutes` and `spesenMinor`. `/api/team*`: unchanged apart from worked minutes (no Spesen).

### 4. Owner API: firm settings and rules
- `GET /api/firm` → `FirmSettingsView` (works with no settings row: the defaults, `locked: false`).
- `PUT /api/firm/settings` `{ currency, timeZone }`: values must be from the lists (`invalid`); `notEditable` once the firm has shifts; upserts the row.
- `POST /api/firm/rules` (schedule; `taken`, `invalid`), `PATCH|DELETE /api/firm/rules/:id` (upcoming only, else `notEditable`; delete answers the view).
- Everything runs through `requireOwner`; others get `role`. `scripts/check-firm.mjs` + `npm run check:firm`: every role, Firm B can't see or change Ivanov, lock after shifts, upcoming-only edits, `taken`.

### 5. App: Firm settings screens and pay display
- `src/firm/` `useFirmSettings()`. Screens `src/app/(app)/profile/firm.tsx` and `rules-change.tsx` (form sheet registered in the profile `_layout`), components in `src/components/firm/`. Profile row for owners.
- Pay card Spesen line, breakdown Spesen column, review pay card break and Spesen rows, break footnote on the shift detail and submitted card.
- Strings in en, bg, de (`firm.*`).

## Verification
- `npx tsc --noEmit`, `npx expo lint`, `npm run check:work-time`, `node --no-warnings scripts/check-salary.mjs`.
- After `db:seed` with the dev server running: `check:firm`, `check:pay`, `check:approvals`, `check:calendar`, `check:pay-rates`, `check:api`.
- **Hand-calculated month** (hourly €16.00, from the 15th €18.00, law defaults):
  - 3rd 5:50 h → no break, 5:50 h → €93.33, no Spesen
  - 7th 8:00 h → −0:30 → 7:30 h → €120.00, no Spesen (not over 8:00)
  - 10th 9:30 h → −0:45 → 8:45 h → €140.00, Spesen €14.00
  - 12th 10:00 h rejected → nothing
  - 20th 8:30 h at €18 → −0:30 → 8:00 h → €144.00, Spesen €14.00
  - Total: 30:05 h, salary €497.33, Spesen €28.00. Also a rule entry starting on the 15th with a 15-min break changes only the 20th.
- On the phone: as owner, open Profile → Firm settings, see currency/timezone locked (seeded firm has shifts), schedule a rule change for next month, edit it, cancel it. As courier, check Pay shows `H:MM h`, the Spesen line, and the break footnote on a long shift. As dispatcher, the review detail shows the break and Spesen.

## AGENTS.md updates
- **Data:** add `firm_rules` (dated break + Spesen rules, `user_id`-free) to the table list.
- **API:** add `GET /api/firm`, `PUT /api/firm/settings`, `POST /api/firm/rules`, `PATCH|DELETE /api/firm/rules/:id` to the owner routes; every `Shift` carries `breakMinutes` and `workedMinutes`.
- **Domain → Salary:** hourly pay uses worked minutes (shift time minus the automatic break from the firm rule in force that day); Spesen per approved shift over the threshold, for all pay types, separate from salary; rule changes start on a date, like rates.
- **Domain → Firm:** currency and timezone are set by the owner and locked once the firm has shifts.
- **Expo / UI:** hours always show as `H:MM h` via `format.hours`, never decimals.
- **Who sees what:** courier also sees own Spesen; owner can change break and Spesen rules.

## Result
Built as planned, with these differences:
- Domain files may only import each other's types at runtime, so `ruleFor`, `breakFor`, `spesenFor` and `shiftSpesen` live in `salary.ts` (next to `latestOn`). The lists, `LAW_DEFAULTS` and the input rules (`parseRule`, `parseSettings`, `parseClock`, `validRule`) are in `src/domain/firm.ts`. There is no `work-time.ts`.
- The break is computed in SQL (`breakMinutesSql` in `src/server/work-rules.ts`) inside the shift select and the Team totals, so `toShift` and every route stay as they were. `check:firm` asserts that it equals `breakFor` on every reviewed shift.
- Rule writes don't need a settings row: they use the firm's today in the default timezone when there's none (`settingsToday`).
- Confirms (past start, cancel) use the themed `ActionSheet`, not `Alert.alert`, and its action list now scrolls above 60% of the screen height so the 13 timezones fit.
- Spesen in review detail sits in `pay`, so a shift with no rate in force shows no Spesen there (Pay still counts it).
- The existing checks now expect worked minutes (`check:pay`, `check:calendar`, `check:pay-rates`, `check:approvals`: the corrected 8:42 h shift pays 492 min and earns Spesen).

Verified: tsc, lint, `check:work-time`, `check-salary` (month C: 30:05 h, €497.33 + €28.00 Spesen), and against the dev server `check:firm` (35), `check:calendar`, `check:pay`, `check:pay-rates`, `check:approvals`, `check:api`. Not verified on a device yet.

Emulator review (Test C owner, Android) found and fixed:
- Opening Firm settings now saves the default settings row when a firm has none, so a new firm stops answering `firmNotSetUp` everywhere else.
- With only an upcoming rule, the card shows that rule with "Starts {date}" instead of the "no rule yet" warning.
- The rule sheet's steppers are centred against their fields (Stepper aligns itself to the start).
Seen and not fixed (existing Toggle): the Android thumb is blue because the `white` token is never emitted (no className uses it).
