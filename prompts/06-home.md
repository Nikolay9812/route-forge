# 06 · Home screen and native tabs

Status: done

## Goal
A signed-in courier lands on a Home tab that shows today's shift, this month's approved hours, packages, kilometers and estimated pay, and their recent shifts. The app gets a native tab bar (Home, Shifts, Pay, Profile). Data comes from a clearly marked sample hook until the shifts API exists. Motion is subtle and runs on the UI thread.

## Decisions
- **Data:** sample data behind `useHomeSummary()` in `src/home/`. The screen only sees `{ status, data, refresh }`, so the shifts-API plan replaces the hook and nothing else. A "Sample data" tag sits at the top of Home until then.
- **Role:** courier Home only. Dispatcher and owner homes come with the Clerk Organizations plan.
- **Tabs:** `NativeTabs` from `expo-router/native-tabs` (SDK 58 path, no longer `unstable-`) in `src/app/(app)/_layout.tsx`: Home, Shifts, Pay, Profile. Shifts and Pay are placeholder screens. Profile shows name, email and Sign out, which moves off Home. No stack inside tabs yet (no nested screens). `/` keeps redirecting to `/home`.
- **Tab icons** come from the registry: `<NativeTabs.Trigger.Icon sf={icons.x.ios} md={icons.x.android} />`. Home → `home`, Shifts → `shifts`, Pay → `salary`, Profile → `profile`. Labels from translations.
- **Tab colors:** `tintColor` / selected icon and label `secondary-ink`, unselected `ink-muted`, Android `backgroundColor` `surface` and `indicatorColor` `secondary-soft`. iOS keeps the system bar material (Liquid Glass). Label font is the semibold family of the current font script. Colors read with `useThemeColor`.
- **Salary math is shared code** in `src/domain/salary.ts`, pure and server-safe (no React, no `@/` imports), so API routes reuse it later. Pay = Σ over *approved* shifts of `round(minutes × rate / 60)`, rate = the courier's rate with the latest `effectiveFrom ≤ shift date`. Per-shift rounding, half up, integer minor units. Draft, submitted and rejected shifts count 0.
- **Dates:** shift dates are calendar strings `YYYY-MM-DD` in the firm's timezone. `src/domain/dates.ts` gives `todayIn(timeZone)` and month helpers via `Intl.DateTimeFormat`. The sample firm is `{ currency: "EUR", timeZone: "Europe/Sofia" }` (Bulgaria uses the euro since 2026). Never "Ivanov Transport" in code.
- **Formatting:** money with `Intl.NumberFormat(language, { style: "currency", currency })` from minor units; month hours with one decimal (`142.5`); a single shift's time as "7 h 30 min" from translation keys. Dates with `Intl.DateTimeFormat(language, { timeZone })`.
- **Sample month** is generated relative to today in the firm timezone, so it always looks current: weekdays from the 1st to yesterday, a mix of approved, submitted and one rejected shift, today as a `draft`, a rate change on the 15th (€8.00 → €9.00/h). In `__DEV__` only, a `sample` search param switches scenario: `full` (default), `empty`, `error`, `offline` — e.g. `routeforge://home?sample=empty`.
- **States:** loading = static skeleton blocks (`bg-border`, no shimmer loop). Error = danger `Alert` with Retry. Offline = the offline `Alert` with Retry. Empty = today's "no shift yet" card, a month card with zeros and "No approved shifts yet this month", and no recent list. Pull to refresh with `RefreshControl` re-runs the hook. Online-only rule: nothing cached.
- **Web SSR:** greeting (time of day) and dates differ between server and browser, so they render only once data has loaded after mount. The first render is the skeleton on both.
- **"Log today's shift" / "Continue shift" / "Fix and resubmit"** go to the Shifts tab for now. The shift form is a later plan.
- **No new dependencies.** Reanimated 4.7.1 and worklets are installed. No haptics: nothing on Home commits an action, so `expo-haptics` isn't needed. No gestures, so no `GestureHandlerRootView`.

### Motion (expo-animation skill gate)
| What | Tier / purpose | Implementation |
| --- | --- | --- |
| Tab switches | 100+/day | **No animation.** Native tab bar behavior only. |
| Home sections appearing when data first arrives (header, today, month, recent) | Occasional (cold start, after sign-in; tabs stay mounted) / preventing a jarring skeleton → content swap | Layout animation `entering`: opacity 0 → 1 and `translateY` 8 → 0, 250 ms, `Easing.bezier(0.23, 1, 0.32, 1)`, stagger 50 ms per section. Builders memoized. Never re-fires on refresh or tab return (sections stay mounted). |
| Pressable cards, avatar, "See all" | Tens/day / feedback | New `PressableScale` primitive: Reanimated CSS transition on `transform`, scale 1 → 0.97, 120 ms, `cubicBezier(0.23, 1, 0.32, 1)`, feedback on press-in, `pressRetentionOffset` 16, `hitSlop` to reach 44 pt. |
| Recent-shift rows | Tens/day / feedback | Full-width rows don't scale: background highlight `active:bg-canvas`. |
| Pay amount, numbers | — | No count-up (seen daily; fails the gate). |
- **Reduced motion:** `useReducedMotion()`; entrances become opacity-only (no translate), press scale is dropped (opacity 0.85 instead).
- Only `transform` and `opacity` animate. Feel is judged on the user's Samsung, ideally in a release build.

### Proposed new token
- `--color-on-inverse-muted`: light `#a3a9b6`, dark `#5b6270`. Secondary text on the inverse pay card (`ink-muted` / `neutral` fail contrast there in dark mode). Added to `@theme`, the dark block, `src/theme/colors.ts`, and `textColors`.

## Design (Home, courier; no image, designed in this plan)
Screen `bg-canvas`, `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`, safe area top, `px-4`, `gap-6`, bottom padding so content clears the tab bar.

1. **Header** (`pt-2`, row, space-between, items-center)
   - Left column, `gap-1`: date `footnote` `ink-muted` ("Saturday, 25 October"), greeting `heading` ("Good morning, Maria" — first word of `fullName`; morning < 12:00, afternoon < 18:00, evening otherwise, in the firm timezone).
   - Right: avatar, `PressableScale` → Profile tab, `size-icon-button rounded-full bg-primary-soft`, initials `label` `ink`. `accessibilityLabel` "Profile".
   - Below the row: `Tag tone="highlight" size="sm"` "Sample data".
2. **Today card** — `Surface raised`, `p-5`, `gap-4`.
   - Top row: "Today" `label` + status `Tag` (shift states) on the right when a shift exists.
   - *No shift:* `size-ghost rounded-full bg-secondary-soft` circle with `shifts` icon (`secondary-ink`), title "No shift logged yet" `title`, body "Log your hours, packages and kilometers when you finish." `body`, primary `Button` "Log today's shift".
   - *Shift exists:* three metrics in a row, each column `gap-1`: icon (`hours`, `packages`, `km`, `sm`, `ink-muted`) + value `number` + caption `footnote` ("7 h 30 min" shown as value "7:30" with caption "hours"; packages "142"; km "86"). Then a `border-t border-border pt-4` row: `car` icon + plate `label` + " · " + depot `footnote`. Draft → primary Button "Continue shift". Rejected → danger `Alert` with the reason, then Button "Fix and resubmit". Submitted/approved → no button.
3. **This month** — section title row: month name `title` ("October") + `footnote` "Approved shifts only".
   - **Pay card** — `rounded-lg bg-inverse p-5 gap-2`: "Estimated pay" `footnote` `on-inverse-muted`, amount `display` `on-inverse` ("€259.00"), "30.5 approved hours" `caption` `on-inverse-muted`. If shifts wait for approval: `Tag tone="info" size="sm"` "2 shifts waiting for approval" (plural keys).
   - **Stat tiles** — row of three `Surface outlined p-4 flex-1 gap-2`: icon (`hours` / `packages` / `km`, `sm`, `secondary-ink`), value `number`, caption `footnote` ("hours", "packages", "km"). Approved shifts only.
4. **Recent shifts** — title row: "Recent shifts" `title` + `Button size="sm" variant="secondary"` "See all" → Shifts tab.
   - One `Surface raised` with up to 5 rows (no Surface per row), rows separated by `Divider`. Row: `Pressable` (`active:bg-canvas`, `px-4 py-3`, min height 56), left column: date `label` ("Fri, 24 Oct"), `footnote` plate · depot; right: duration `label` + status `Tag size="sm"`. Rows go to the Shifts tab for now.
   - Empty: the section is hidden; the month card's empty line says why.
5. **Loading:** same layout with `bg-border rounded-md` blocks in place of header text, today card (h-40), pay card (h-32) and three rows. **Error / offline:** header still shows the greeting if the user is known; an `Alert` replaces the cards, with `Button variant="secondary"` "Try again".

**Profile tab:** `bg-canvas`, safe area, `px-4 gap-6`. Large avatar (`size-button`, initials `heading`), name `heading`, email `body`, then `Button variant="secondary"` "Sign out" with the loading state Home has today.
**Shifts / Pay tabs:** centered: icon circle (as the no-shift card), `heading` title, `body` text ("Your shifts will show up here." / "Your monthly pay will show up here.").

## Out of scope
Real shifts API and tables, Clerk Organizations and roles, dispatcher and owner homes, the shift form, shift detail, the Pay screen, firm logo and name, notifications, haptics, offline cache.

## Steps
### 1. Domain utils and salary check
- `src/domain/types.ts`: `ShiftStatus` (`draft | submitted | approved | rejected`), `Shift { id, date, status, minutes, packages, km, carPlate, depotName, rejectionReason? }`, `Rate { effectiveFrom, hourlyMinor }`, `Firm { currency, timeZone }`.
- `src/domain/salary.ts`: `rateFor(date, rates)`, `shiftPay(shift, rates)`, `monthTotals(shifts, rates)` → `{ approvedMinutes, payMinor, packages, km, pendingCount }` (packages/km from approved shifts only).
- `src/domain/dates.ts`: `todayIn(timeZone)`, `monthOf(date)`, `hourIn(timeZone)`.
- Relative imports only, no React, so it runs on the server and under Node.
- `scripts/check-salary.mjs`, run with `node --no-warnings scripts/check-salary.mjs` (Node 24 strips the types of the imported `.ts`), asserts the hand-calculated month below and exits non-zero on mismatch.
Done when the script prints OK, and lint and tsc pass.

### 2. Native tabs, placeholders, Profile
- `src/app/(app)/_layout.tsx` → `NativeTabs` with the four triggers, icons, translated labels and tab colors as decided.
- New `src/app/(app)/shifts.tsx`, `pay.tsx`, `profile.tsx`. Move sign-out from Home to Profile.
- Translations (en, bg, de): `tabs.*`, `profile.*`, `placeholder.shifts.*`, `placeholder.pay.*`. Remove `home.signedInAs` and `home.signOut` once unused.
Done when the tab bar shows on device, each tab opens, Sign out works from Profile, lint and tsc pass.

### 3. Sample data hook
- `src/home/sample.ts`: builds the sample month relative to `todayIn(firm.timeZone)` per the decisions.
- `src/home/use-home-summary.ts`: `{ status: "loading" | "ready" | "error" | "offline", data?: { firm, today?: Shift, recent: Shift[], totals, monthLabelDate }, refresh }`. Loads in an effect (~400 ms delay so loading is visible), computes totals with `monthTotals`. Honors the `sample` param in `__DEV__` only.
Done when tsc passes.

### 4. Home screen
- `src/components/pressable-scale.tsx` (motion table above, reduced-motion aware).
- Add `on-inverse-muted` token (CSS light + dark, `colors.ts`, `textColors`).
- `src/components/home/`: `home-header.tsx`, `today-card.tsx`, `month-summary.tsx`, `recent-shifts.tsx`, `home-skeleton.tsx`, `format.ts` (money, hours, duration, dates through `useLanguage()`).
- `src/app/(app)/home.tsx` composes them with `RefreshControl` and the states.
- Translations (en, bg, de) for every Home string, including `status.*` and plurals.
Done when every scenario renders on device and lint and tsc pass.

### 5. Motion
- Staggered `entering` on the four Home sections, memoized builders, opacity-only under reduced motion.
- `PressableScale` on the avatar; rows use background highlight.
Done when it looks right on device with reduce motion off and on.

### 6. Close out
Run Verification, write `## Result`, set `Status: done`, apply the AGENTS.md updates.

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`.
- **Salary hand check** (`scripts/check-salary.mjs`), October, rates €8.00 from Oct 1 (800) and €9.00 from Oct 15 (900):
  | Date | Status | Minutes | Rate | Pay (cents) |
  | --- | --- | --- | --- | --- |
  | Oct 6 | approved | 480 | 800 | 6400 |
  | Oct 13 | approved | 450 | 800 | 6000 |
  | Oct 14 | rejected | 500 | 800 | 0 |
  | Oct 15 | approved | 495 | 900 | 7425 |
  | Oct 20 | submitted | 480 | 900 | 0 |
  | Oct 21 | approved | 405 | 900 | 6075 |
  Expected: 1830 approved minutes (30.5 h), 25900 cents (€259.00), 1 pending.
- On the user's Samsung, with the dev server the user is already running. Claude never starts Metro or an emulator itself; it asks the user to reload (or restart with `--clear` if a bundle looks stale). The design rule's iOS-simulator screenshot step isn't possible on Windows; screenshots via `adb exec-out screencap -p` if the phone is on USB, otherwise the user's own.
  1. Cold start signed in → skeleton briefly → sections fade up one after another → tab bar with 4 tabs, Home selected.
  2. Switch tabs back and forth → instant, no slide; returning to Home doesn't replay the entrance.
  3. Pull to refresh → spinner, content updates in place without replaying the entrance.
  4. Press and hold the avatar → slight shrink; release → Profile tab. Press a recent row → background highlight.
  5. `routeforge://home?sample=empty`, `?sample=error`, `?sample=offline` → each state as designed; Try again → loading → that state again.
  6. Profile → Sign out → onboarding.
  7. System reduce motion on → sections only fade, avatar dims instead of scaling.
  8. Dark mode, and the app in Bulgarian and German → no clipped text, Cyrillic font on BG, pay card text readable.
- Web (`npx expo start --web`): Home loads without a hydration warning in the console.

## AGENTS.md updates
- **Expo:** signed-in navigation is `NativeTabs` (`expo-router/native-tabs`) in `src/app/(app)/_layout.tsx`; tab icons come from the icon registry (`sf` + `md`).
- **Expo (new bullet, Motion):** Reanimated only (never core `Animated`), `transform`/`opacity` only. Tab switches and screen transitions stay native. Press feedback is `PressableScale` (0.97, 120 ms); full-width rows highlight instead. Entrances only when content first arrives, never on refresh or tab return. Every animation handles reduced motion. Curves: `cubicBezier(0.23, 1, 0.32, 1)` / `Easing.bezier(0.23, 1, 0.32, 1)`.
- **Who owns what → Business logic:** salary math lives in `src/domain/` (pure, no React, relative imports) so API routes and the client share it.
- **Domain → Salary:** pay rounds per shift, half up, in minor units.
- Shared primitives list gains `pressable-scale`; tokens gain `on-inverse-muted`.

## Result
Built as planned. Home (courier, sample data), native tabs (Home, Shifts, Pay, Profile), Profile with Sign out, Shifts/Pay placeholders, shared salary math in `src/domain/`, `PressableScale`, staggered section entrance, and the `on-inverse-muted` token.
- Lint, type check and the salary hand check pass. The user confirmed on their Samsung that tabs, entrance, press feedback and pull to refresh look right.
- Changes from the plan: the salary check is `scripts/check-salary.mjs` (no `allowImportingTsExtensions` needed). `PressableScale` keeps visuals on an inner `View` (`contentClassName`) because NativeWind doesn't style `Animated.View`; its transition style is typed with Reanimated's `CSSStyle`, since `StyleSheet.create` rejects `cubicBezier`.
- Not verified: the `?sample=` scenarios, reduce motion, dark mode, BG/DE, and web hydration were not reported back individually. `npx expo-doctor` flags 6 SDK patch updates that were already out of date before this plan (`expo-router` 58.0.26 and others); nothing was upgraded.
