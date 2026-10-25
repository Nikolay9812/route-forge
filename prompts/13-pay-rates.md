# 13 · Pay rates

Status: done

## Goal
Owners decide how couriers are paid, under Profile → Pay rates. Each courier is paid either **hourly** (approved hours × rate) or with a **day rate** (a fixed amount per approved shift). The firm has a default, and the owner can give any courier their own override. Every change has a start date, so earlier pay stays as it was. Couriers see their current pay type and rate on Home.

## Decisions
- **Two pay types, one per courier at a time:** `hourly` or `daily`. They are never combined. No extras (weekend multipliers, tiers, overtime).
- **A day rate always pays the full amount** for each approved shift, whatever its length. A bad shift is rejected, not paid less.
- **Firm default + per-courier override.** For a given day, the courier's latest own entry on or before that day wins. If they have none, or that entry is "follow firm default", the latest firm default entry on or before the day applies. If neither exists, the shift has no rate and pays 0, shown as "No rate set", never as €0.
- **"Follow firm default"** is a courier entry kind (`firm`) with no amount. It lets the owner end an override from a date without deleting history.
- **Every entry has a start date** (`effectiveFrom`, a calendar day in the firm's timezone). Past dates are allowed. The sheet warns first that approved pay for those days will change, and the server allows it (the warning is UI only).
- **Only upcoming entries** (start date after the firm's today) can be edited or cancelled. Started entries are history and stay as they are. Cancelling an upcoming entry deletes the row; no shift's pay ever depended on it, so the never-hard-delete rule doesn't apply.
- **One entry per target per day.** A second entry with the same start date for the firm default, or for the same courier, answers `taken` (409).
- **Audit:** every entry records `set_by` (Clerk user ID) and `set_at`. Editing an upcoming entry updates both. The history list shows who set each entry.
- **Owners only.** Every pay-rate route answers `role` (403) to dispatchers and couriers. Dispatchers keep seeing a shift's pay and breakdown in review detail as today (allowed by "Who sees what"), but never the rate lists.
- **Couriers see only their own rate** on Home, in the dark month card: "Hourly · €16.00 / h" or "Day rate · €130.00 per shift", plus "From 15 Nov: €17.00 / h" when an upcoming change exists. The Pay tab stays a placeholder (its own later feature).
- **Money in the firm's currency** from firm settings (both test firms use EUR). Amounts are typed as decimals ("16,50" or "16.50"), stored as integer cents, from 0.01 to 1,000.00. All currencies are treated as having two minor digits (true for EUR; noted for later).
- **Rounding is unchanged:** hourly pay is rounded per shift, half up, in minor units. A day rate is exact.
- **Pay is never stored.** Totals and review pay follow the rate in force on each shift's day, so a backdated change updates past months, just as corrections do.
- **Couriers listed** on the Pay rates screen: every `org:courier` member (`firmCouriers`) plus anyone who has their own rate entries (former couriers keep their history), sorted by name.
- **Date picker:** the native one from `@expo/ui` (already a dependency, included in Expo Go): SwiftUI `DatePicker` (compact style) on iOS, Jetpack Compose `DateTimePicker` (`variant="picker"`, no variant toggle) on Android, and a `YYYY-MM-DD` `TextField` on web. No new dependency.
- **Schema:** `courier_rates` is replaced by `pay_rates`. A row with `user_id` null is the firm default, and a row with a user ID is that courier's entry. Data is wiped and re-seeded (no migration of old rows).
- **No design attached.** Built from the Depots & cars screens and existing primitives, with no new tokens.

## Out of scope
- Combined pay (day rate + hourly), per-package/per-km pay, multipliers, tiers, overtime.
- Per-depot defaults.
- Rates for dispatchers or owners themselves.
- The Pay tab (payslips, month history) and pay on the Team tab.
- Firm settings editing (currency, timezone).
- Currencies with zero or three minor digits.

## Design
Built from existing Profile/fleet patterns. Every value maps to an existing token.

- **Profile (owners):** the "Firm" `Surface` gets a second row below "Depots & cars", separated by a `Divider`: `salary` icon, "Pay rates" in `body` `ink`, `chevron` in `ink-muted`. Same row styling (`px-4 py-3`, ≥ 44 dp, `secondary-soft` press highlight).
- **Pay rates screen** (`/profile/pay-rates`): native header "Pay rates", back title "Profile". `ScrollView` `bg-canvas` `px-4` `gap-4`.
  - A warning `Alert` at the top, only when some couriers have no rate today: "N couriers have no pay rate. Set a firm default or a rate for them."
  - A `footnote` `ink-muted` label "Firm default", then a `Surface` with one pressable row: the rate as `label` `ink` ("€16.00 / h" or "€130.00 per shift", or "Not set" in `ink-muted`), the type under it in `footnote` `ink-muted` ("Hourly" / "Day rate"), an "Upcoming change" `Tag` (`info`, `sm`) when one exists, and a `chevron`. It opens the firm default detail.
  - A label "Couriers", then a `Surface` with one row per courier, separated by `Divider`s: name in `body` `ink`. On the right, the rate in `footnote` `ink` ("€16.00 / h"), then a `Tag` "Firm default" (`role` tone) when the courier follows the default today, or "No rate" (`danger` tone) when none applies. Then a `chevron`. It opens that courier's detail.
  - Empty (no couriers): "No couriers yet" in `body` `ink-muted`, centred.
- **Rate detail** (`/profile/pay-rate?userId=`, with no `userId` for the firm default): native header with the courier's name or "Firm default".
  - A `Surface` `p-5` with "Current rate" (`footnote`), the amount (`number`), the type line (`footnote`), and for couriers following the default "Uses the firm default".
  - A `Button` "Schedule a change" (`secondary`, full width) opens the change sheet.
  - The label "History", then a `Surface` listing every entry, newest start date first. Each row shows the start date (`label`), the amount and type, or "Firm default" for a `firm` entry (`body`), and "Set by Olga Owner · 12 Oct" (`footnote` `ink-muted`). A `Tag` sits on the right: "Upcoming" (`info`), "Current" (`success`) or none for ended entries. Only upcoming rows are pressable (with a `chevron`) and open the sheet in edit mode.
- **Change sheet** (`/profile/rate-change?userId=&id=`): a form sheet with the fleet sheet shell (`FleetSheet`: `fitToContents`, grabber, corner 20, `px-4 pt-6`, bottom inset, `gap-4`).
  - The title is "New rate" or "Edit upcoming rate", with the target's name (or "Firm default") as the body line.
  - A `SegmentedControl` with "Hourly | Day rate", plus "Firm default" for couriers only.
  - A `TextField` "Amount", hidden for "Firm default": `keyboardType="decimal-pad"`, the currency symbol as a suffix if `TextField` supports one, and a hint "per hour" or "per shift". Errors appear under the field.
  - "Starts on" with the date field, defaulting to the 1st of next month for a new entry.
  - An inline warning `Alert` when the date is before the firm's today: "This changes approved pay from {date}, including past months." Saving then asks in a native `Alert.alert` (Cancel / Change past pay).
  - A `Button` "Save" (`primary`), disabled while invalid or unchanged, loading while saving.
  - In edit mode, a `Button` "Cancel this change" (`destructive` ghost), with a native confirm.
  - Errors: `taken` shows under the date ("There's already a change on this day"), `notEditable` shows inline ("This rate has already started"), and offline shows the offline `Alert` while keeping the input.
- **Home (couriers):** in the dark month card, below the hours/shifts caption, a `caption` `on-inverse-muted` line with the current rate ("Hourly · €16.00 / h", "Day rate · €130.00 per shift", or "No pay rate set yet"), and under it the upcoming change line when one exists. For day-rate couriers the existing caption reads "N approved shifts" instead of hours.
- **Review detail pay card:** hourly keeps "8.5 h × €16.00". A day rate shows "Day rate".
- **States:** a skeleton while loading, an error `Alert` with Retry, the offline `Alert`, and the empty states above. List content fades up on first load only (house curve, fade only under reduced motion). Pushes and sheets stay native.

## Steps

### 1. Domain: pay schedule and salary math
In `src/domain/types.ts`:
- Replace `Rate` with `PayKind = "hourly" | "daily"` and `Rate = { effectiveFrom: string; kind: PayKind; amountMinor: number }`.
- Add `RateEntry = { effectiveFrom: string; kind: PayKind | "firm"; amountMinor: number | null }` and `PaySchedule = { firm: Rate[]; own: RateEntry[] }`.
- Add the owner view types:
  - `PayRateEntry = { id; effectiveFrom; kind: PayKind | "firm"; amountMinor: number | null; upcoming: boolean; current: boolean; setByName: string; setAt: string }`
  - `PayRateTarget = { current: Rate | null; next: Rate | null; followsFirm: boolean; entries: PayRateEntry[] }`
  - `PayRates = { today: string; firmDefault: PayRateTarget; couriers: (PayRateTarget & { userId: string; name: string })[] }`
  - `CourierRate = { current: Rate | null; next: Rate | null }` (for Home)

In `src/domain/salary.ts`:
- `rateFor(date, schedule: PaySchedule): Rate | null` with the resolution rule from Decisions. `next` for the views uses the same rule.
- `shiftPay(shift, schedule)`: approved only; `hourly` → `Math.round(minutes × amountMinor / 60)`, `daily` → `amountMinor`.
- `monthTotals(shifts, schedule)` also counts `approvedShifts`.

Add `src/domain/pay-rates.ts` (pure, type imports only):
- `parseAmount(text)`: digits with an optional `,` or `.` and up to two decimals, 0.01–1000.00 → minor units, or null.
- `formatAmountInput(minor)` for prefilling the field.
- `parseRateCreate(body)` → `{ userId: string | null; effectiveFrom; kind; amountMinor }`: `firm` only with a `userId`, an amount required unless `firm`, integer 1–100000, and a real calendar date.
- `parseRatePatch(body)` → a partial of the same fields, no unknown keys, not empty.

Both parsers return the existing `Parsed<T>`.

Rewrite `scripts/check-salary.mjs` to hand-check two months:
- **A, firm default only** (the old month, as `firm` rates with no own entries): unchanged result, 1830 min, 25900, 1 pending.
- **B, overrides:**
  - Rates: firm hourly 800 from 2026-09-01 and 905 from 2026-10-15. Courier: daily 12000 from 2026-10-10, then `firm` from 2026-10-20.
  - Shifts and expected pay:
    - 10-06 approved, 480 min, firm 800 → 6400
    - 10-13 approved, 450 min, day rate → 12000
    - 10-14 rejected → 0
    - 10-15 approved, 495 min, day rate → 12000
    - 10-20 submitted → 0
    - 10-21 approved, 405 min, firm 905 → 405 × 905 / 60 = 6108.75 → 6109
  - Total 36509, 1830 min, 4 approved shifts, 1 pending.
- Also assert that a date before any rate returns null and pays 0.

Done when `node --no-warnings scripts/check-salary.mjs` passes and `tsc` points only at the callers fixed in step 2.

### 2. Schema, seed and existing callers
- In `src/db/schema.ts`, replace `courierRates` with `payRates` (`pay_rates`): `id` uuid, `firmId`, `userId` text nullable (null = firm default), `effectiveFrom` date string, `kind` (new `pay_kind` enum: `hourly`, `daily`, `firm`), `amountMinor` integer nullable, `setBy` text not null, `setAt` timestamptz not null default now, and `createdAt`. Add a unique index on `(firmId, userId, effectiveFrom)` with `.nullsNotDistinct()`, so the firm default is unique per day too. Add check constraints: amount null exactly when kind is `firm`, `firm` only with a user ID, and amount > 0.
- Run `npm run db:push`. It drops `courier_rates`, and accepting the data loss is intended. If push asks interactively, the user confirms it in their terminal.
- Add `payScheduleOf(firmId, userId)` in a new `src/server/pay-rates.ts`: one query for the firm default rows plus that user's rows. Replace `ratesOf` in `src/server/shifts.ts` and `ratesOfUser` in `src/server/approvals.ts` with it.
- Review detail returns `pay: { kind, amountMinor, payMinor } | null`. Update `src/approvals/approvals.tsx`'s type and `PayCard` (day rate → "Day rate" breakdown).
- In `scripts/seed.mjs`, insert into `pay_rates` with `set_by` = the owner:
  - Ivanov firm default hourly: the same four dates and amounts as today.
  - courier.c's own daily 13000 (€130.00) from the 1st of last month.
  - Test Firm B default hourly 1200.
  - courier.a keeps following the default.
- In `scripts/check-approvals.mjs`, the expected-pay query reads the firm default from `pay_rates` (courier.a has no override).

Done when `npm run db:seed` runs, `check:approvals` and `check:api` pass, and `tsc` passes.

### 3. Server and API routes
In `src/server/pay-rates.ts`, every query filters by `firmId` and uses Drizzle parameters only:
- `payRatesOf(firmId, today)` builds `PayRates`:
  - couriers = `firmCouriers` ∪ user IDs with own rows, with names from `userNames`, including `setBy` names
  - `current`/`next`/`followsFirm` via `rateFor`
  - `upcoming` = `effectiveFrom > today`
  - `current` marks the entry in force today
- `createRate(firmId, ownerId, input)`: a non-null `userId` must be in `firmCouriers` or already have rows in this firm, else `invalid`. A unique violation (`23505`) → `taken`.
- `updateRate(firmId, ownerId, id, patch, today)` and `deleteRate(firmId, id, today)`: a row of another firm or an unknown ID → `notFound`, a started row → `notEditable`. The merged result is validated again (amount vs kind; `firm` only for couriers). An update setting a date that collides → `taken`.

Routes, each `handle` → `requireOwner` → `loadFirm` (`firmNotSetUp`) before any work, answering only `{ error: code }`:
- `src/app/api/pay-rates/index+api.ts`: `GET` → `PayRates`. `POST` → 201 with the updated `PayRateTarget` for that target.
- `src/app/api/pay-rates/[id]+api.ts`: `PATCH` → the updated `PayRateTarget`. `DELETE` → the updated `PayRateTarget`.
- `GET /api/home` also returns `rate: CourierRate` (the courier's own schedule only).

Done when `curl` with an owner token lists rates and creates an entry, and a dispatcher gets 403.

### 4. Check script: `npm run check:pay-rates`
Add `scripts/check-pay-rates.mjs` using `scripts/lib/api-test.mjs`, and a `check:pay-rates` script in `package.json` (same flags as `check:fleet`). It uses start dates far in the future (year 2090 + run offset) so it never changes seeded pay, except where a check needs a past date. Those rows are removed with SQL at the end.
- **Owner:**
  - GET lists the firm default and courier.a, courier.c with the right `current` (courier.a hourly via the default, `followsFirm`; courier.c daily 13000).
  - Create an upcoming firm default entry, then the same date again → 409 `taken`.
  - Create an upcoming courier.a daily entry, edit its amount and date, then delete it.
  - Create a `firm` entry for courier.c.
- **Past entries:** PATCH or DELETE of a started entry (a seeded one) → 409 `notEditable`.
- **Backdating:**
  - Give courier.c a past hourly entry dated on one of their approved shifts this month.
  - `GET /api/approvals/:id` as the owner shows hourly pay for that shift, and courier.c's `GET /api/home` totals change.
  - Then delete that entry with SQL and check the totals are back.
- **Pay shapes:**
  - The owner's review detail for a courier.c approved shift shows `pay.kind === "daily"` and `payMinor === 13000`.
  - courier.a's home `rate.current` is hourly 1600 or 1500 depending on the day, and `rate.next` shows the upcoming entry while it exists.
- **Roles:** the dispatcher, courier.a and courier.b on every pay-rate route → 403 `role`. courier.a's home `rate` contains only their own schedule, with no other courier's data.
- **Tenant isolation:** the Ivanov owner can't PATCH or DELETE a Firm B rate (ID from SQL) → 404, and that row is unchanged. The Ivanov GET contains no Firm B users. POST with courier.b's user ID → 400.
- **Bad input → 400:**
  - an amount of 0, a negative amount, 100001, or a non-integer
  - `kind: "firm"` without a `userId`, and `firm` with an amount
  - a date of `2026-02-30`
  - unknown keys, a non-UUID ID, an empty patch

Done when every check passes after `npm run db:seed`, against the dev server.

### 5. App: data hook, date field, Profile entries
- Add `src/pay-rates/pay-rates.tsx` with:
  - `PayRatesProvider`: a shared revision, like `FleetProvider`.
  - `usePayRates()`: `useResource`, quiet reload on focus.
  - `usePayRateActions()`: `create`, `update`, `remove`, which return the row or the `ApiFailure` code and bump the revision on success.
- Add `src/components/date-field.tsx` (web: `TextField` with `YYYY-MM-DD`), `.ios.tsx` (SwiftUI `Host` + `DatePicker` with `datePickerStyle('compact')`) and `.android.tsx` (Compose `Host matchContents={{ vertical: true }}` + `DateTimePicker`, `displayedComponents="date"`, `variant="picker"`, `showVariantToggle={false}`, `color` from `useThemeColor("primary")`).
  - Props: `{ label, value: "YYYY-MM-DD", onChange }`.
  - Before writing it, check that the picker's `Date` maps to the chosen calendar day on both platforms: the Compose picker may return UTC midnight, so take UTC parts there and local parts on iOS. Confirm on the phone in step 6.
- In `src/app/(app)/profile/_layout.tsx`, wrap the stack in `PayRatesProvider` as well, and add `pay-rates` and `pay-rate` (native headers, back title "Profile" / "Pay rates") plus `rate-change` (sheet options).
- Profile index: add the "Pay rates" row to the owner "Firm" section.

Done when Profile still works for every role and owners see both rows.

### 6. App: screens, sheet and Home line
- Build `profile/pay-rates.tsx`, `profile/pay-rate.tsx` and `profile/rate-change.tsx` as described in Design, with components in `src/components/pay-rates/`, reusing `FleetSheet`, `useSheetSave` and the fleet row component where they fit.
- The sheet reads the entry from the provider's cached `PayRates`. It needs the firm's `today` (in the response) for the backdate warning.
- Add the Home rate line to `MonthSummary` (`rate` from `useHomeSummary`), plus the "N approved shifts" caption for day-rate couriers.
- Add every string to `src/i18n/locales/{en,bg,de}.json` under `payRates.*`, plus the new `home.month.*` and `review.*` keys:
  - BG: "Ставки на заплащане", "Почасово", "Дневна ставка", "По подразбиране за фирмата".
  - DE: "Lohnsätze", "Stundenlohn", "Tagessatz", "Firmenstandard".
  - "per hour"/"per shift" become "на час"/"на смяна" and "pro Stunde"/"pro Schicht".

Done when an owner can do every action from the check script by hand on the phone, and lint and `tsc` pass.

## Verification
1. `npx expo lint` and `npx tsc --noEmit` pass.
2. `node --no-warnings scripts/check-salary.mjs` passes (both hand-calculated months).
3. `npm run db:seed`, then `check:pay-rates`, `check:api`, `check:approvals`, `check:calendar` and `check:fleet` all pass.
4. On the phone (the user runs Metro and reloads):
   - **As the owner:**
     - Profile → Pay rates shows the firm default €16.00 / h (or €15.00 before the 15th), courier.a with the "Firm default" tag, and courier.c on €130.00 per shift.
     - Schedule a firm default change for the 1st of next month: it shows as Upcoming. Edit it, then cancel it.
     - Give courier.a a day rate starting on a past date: the warning and confirm appear. Afterwards, courier.a's Home and a review detail show day-rate pay. Then set courier.a back to "Firm default" from today.
     - The date picker picks the right day on Android (and iOS if available).
     - In airplane mode, saving shows the offline alert and keeps the input.
     - Dark mode and BG/DE strings fit.
   - **As courier.a / courier.c:** Home shows "Hourly · €16.00 / h" / "Day rate · €130.00 per shift", and an upcoming line when one exists.
   - **As the dispatcher:** no Pay rates row. Review detail shows "Day rate" for courier.c-style shifts in scope.
5. Screens are compared against the Depots & cars patterns (no attached design). Every estimated value is listed in the report.

## AGENTS.md updates
- **Domain → Salary:** replace "hourly only, for now" with:
  - Pay is hourly (approved minutes × rate, rounded per shift half up) or a day rate (a fixed amount per approved shift), one type per courier at a time.
  - The rate in force on a shift's day is the courier's latest own entry on or before it, else the firm default's latest (a `firm` entry means "follow the default").
  - Only upcoming entries can be edited or cancelled, and past start dates are allowed after a warning.
  - Every entry records who set it and when.
- **Data → Tables:** `courier_rates` → `pay_rates` (`user_id` null = firm default).
- **API:** the owner routes `GET|POST /api/pay-rates` and `PATCH|DELETE /api/pay-rates/:id` (upcoming only). `GET /api/home` includes the courier's own `rate`. Commands: `check:pay-rates`.
- **Shift form / Profile line:** owners get Pay rates in Profile (`usePayRates()` from `src/pay-rates/`). `DateField` in `src/components/` wraps the `@expo/ui` native date pickers.
- **Who sees what:** the owner row already covers rates. Add that dispatchers see shift pay in reviews but never rate lists.

## Result
Built as planned. Owners set the firm default and per-courier overrides (hourly, day rate, or "follow firm default") under Profile → Pay rates, with dated changes, history, and edit or cancel for upcoming entries. Couriers see their rate on Home, and review detail shows day-rate pay. `check-salary.mjs` passes both hand-calculated months. `npm run check:pay-rates` passes all 50 checks, and `check:api`, `check:approvals`, `check:calendar` and `check:fleet` still pass. Lint and `tsc` are clean. Deviations:
- `db:push` couldn't decide by itself whether `pay_rates` was a rename of `courier_rates` (an interactive prompt). It was pushed in two passes, both with `drizzle-kit push`: first without the new table (dropping `courier_rates`), then with it.
- The unique rule is a `unique().nullsNotDistinct()` constraint, because Drizzle's `uniqueIndex` has no `nullsNotDistinct`.
- `ownerContext` now also returns the firm and its today, and `PayRates` carries `firm` (the screens need the currency).
- Android uses `DatePickerDialog` (opened from a read-only field) instead of the inline `DateTimePicker`, which fits a sheet better. iOS uses the compact SwiftUI `DatePicker`.
- `Alert` has no warning tone, so the missing-rate and backdate warnings use `danger`. "Current" uses the `highlight` tag and "No rate" uses `rejected` (it has a dot), since `Tag` has no plain success or danger tone.
- The phone walkthrough (step 4 of Verification) is left to the user. Not checked yet: the Android picker's day mapping (UTC in and out) and the iOS picker (there's no simulator on this Windows machine).
