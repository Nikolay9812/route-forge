# Route Forge

Expo React Native app for courier companies. Couriers log their daily work (hours, packages, kilometers, car). Dispatchers approve it. Owners see the whole firm, including salaries. One app serves many logistics firms: Ivanov Transport is the first, and others can join later without code changes.

This file is the project's memory: it holds every decision that is still true. Plans in `prompts/` are history.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm install: resolves SDK-compatible versions
npx expo start              # dev server (press i for the iOS simulator)
npx expo lint               # lint
npx tsc --noEmit            # type check
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
npx eas-cli@latest <cmd>    # EAS builds, submits, and updates (use instead of bare `eas`)
npm run db:push             # push the Drizzle schema to the Neon branch in .env.local
npm run db:seed             # wipe and re-seed the test firms (depots, cars, rates, six months of shifts)
npm run check:api           # API role/firm/validation checks against the running dev server (dev branch only)
npm run check:approvals     # approvals scope/review/correction checks (run db:seed first; dev branch only)
npm run check:calendar      # calendar/team scope checks (run db:seed first; dev branch only)
npm run check:fleet         # owner depot/car management checks (run db:seed first; dev branch only)
npm run check:pay-rates     # owner pay-rate checks: roles, firms, resolution, backdating (run db:seed first; dev only)
```

## Expo

- Expo ships breaking changes every SDK release, so don't trust memory. Before touching an Expo, EAS, or React Native API, check the `expo` major version in `package.json` and read `https://docs.expo.dev/versions/v<major>.0.0/`. For anything else, start from https://docs.expo.dev/llms.txt and follow its links.
- Routes live in `src/app/`: every file is a screen and `_layout.tsx` files define navigators. API routes are `src/app/api/*+api.ts`. Keep components, hooks, and utils outside `src/app/`.
- `ios/` and `android/` are generated. Never create or edit them by hand; configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, switch to a development build (`npx expo run:ios`).
- Styling uses NativeWind v5 (pinned RC) with Tailwind v4: `className` on React Native components. `src/global.css` is the only stylesheet and is imported in the root layout. Use `StyleSheet` only for what a utility can't express. Keep `nativewind`, `react-native-css`, `tailwindcss`, `@tailwindcss/postcss`, and `lightningcss` (also forced via `overrides`) pinned, and upgrade them together using the NativeWind v5 docs. `metro.config.js` lets `node_modules` import the real `react-native` (NativeWind's re-export drops `AssetRegistry`, which breaks fonts and icons on Android); keep that when touching Metro config.
- Design tokens live only in `src/global.css` (`@theme`, with dark values under `prefers-color-scheme`). Tailwind's default palette, type scale, radii, and shadows are removed, so use Route Forge tokens (`bg-canvas`, `text-ink`, `rounded-md`, `h-button`). Spacing is a 4px step (`p-4` = 16). Line-height tokens are unitless ratios (`calc(22 / 15)`), never px: on Android NativeWind reads a px line height as a multiplier and text disappears. Dark mode follows the system. In JS, read colors with `useThemeColor` from `@/theme`, never hex.
- Text goes through `ThemedText` with a `variant` and optional `color` token, never `font-bold`, `text-[n]`, or a color className (two color classes resolve by stylesheet order). Fonts: Plus Jakarta Sans for EN and DE, Manrope for BG (Plus Jakarta Sans has no Cyrillic), static weights in `assets/fonts/` loaded with `useFonts` in the root layout. `FontScriptProvider` picks the family.
- Icons: `expo-symbols` through `<Icon name color>`, with names from the registry in `src/components/icons.ts`. Add new icons there with an iOS and an Android name.
- Shared primitives live in `src/components/` (button, icon-button, text-field, chip, segmented-control, stepper, toggle, tag, alert, surface, pressable-scale). Check them before building a new control. Their `className` is for layout only, and they take all text as props. `/design-system` is a dev-only showcase of all of them.
- On web, routes are server-rendered, so anything that differs between server and browser (locale, color scheme, `window`) must not change the first render.
- i18n: `expo-localization` + `i18n-js`. Strings live in `src/i18n/locales/{en,bg,de}.json` (en is the source of key types) and are read with `useTranslation()` from `@/i18n`. `useLanguage()` gives the app language (en on the server's first render) and also picks the font script via `fontScriptFor`.
- Stock photos (Unsplash) are downloaded into `assets/images/<feature>/` with a `CREDITS.md`, never hotlinked.
- Routing by auth: `/` redirects by Clerk auth state. Signed-out users get onboarding and `(auth)`, signed-in users get `(app)`, guarded with `Stack.Protected` in the root layout. The splash stays up until fonts and Clerk are loaded.
- `(app)` is `NativeTabs` from `expo-router/native-tabs`, the platform's own tab bar. Tabs depend on the role: couriers get Home, Shifts, Pay, Profile; dispatchers and owners get Approvals, Team, Profile (the others are `hidden`, which also blocks navigating to them). `/` redirects reviewers to `/approvals`, everyone else to `/home`. Tab icons come from the icon registry (`sf` + `md`), labels from translations, colors from `useThemeColor`.
- Motion: Reanimated only (never core `Animated`), animating `transform` and `opacity` only, following the `expo-animation` skill. Tab switches and screen transitions stay native. Press feedback on cards and round buttons is `PressableScale` (scale 0.97, 120 ms); full-width rows highlight their background instead. Content fades up only when it first arrives, never on refresh or tab return. Every animation handles reduced motion (fade only, no movement). Curve: `cubicBezier(0.23, 1, 0.32, 1)` in CSS transitions, `Easing.bezier(0.23, 1, 0.32, 1)` in builders. `Animated.View` takes no `className`: put animation in `style` (typed `CSSStyle`) and visuals on an inner `View`.

## Who owns what

Each tool has one job. Ask before moving a responsibility to a different tool.

- **Auth, firms, and roles:** Clerk is the source of truth. Each firm is a Clerk Organization. A user's role in that firm is a Clerk org role: `owner`, `dispatcher`, or `courier`. The app keeps its own custom auth screens. They import auth only from `src/auth/`, which adapts `@clerk/expo`'s current custom-flow API (`{ error }` results, `finalize()`) and maps Clerk error codes to translation keys, so screens never show raw Clerk messages. Sessions persist through Clerk's `tokenCache` (`expo-secure-store`). Change Clerk instance settings through the Clerk MCP server (`.mcp.json`) or the Clerk CLI (in Git Bash prefix `clerk api` calls with `MSYS_NO_PATHCONV=1`), and use the Clerk skills for current Expo patterns.
- **Organizations:** roles are `org:owner`, `org:dispatcher`, `org:courier` (Clerk's `org:admin`/`org:member` are unused). New members default to courier, creators get owner, organization selection isn't forced. People join by invitation from the Clerk dashboard. `useFirm()` in `src/auth/` activates the first membership; with none, `(app)` shows `NoFirm` with pending invitations to accept. Test firms: Ivanov Transport and Test Firm B, with `+clerk_test` users courier.a, courier.c, dispatcher, owner (Ivanov) and courier.b (Firm B).
- **Data:** Neon Postgres holds depots, cars, shifts, pay rates, and firm settings. Only API routes reach it, through `DATABASE_URL`. The app never talks to the database directly. Access goes through Drizzle ORM over Neon's HTTP driver. Tables live in `src/db/schema.ts` (camelCase in TS, snake_case columns) and the `db` client in `src/db/index.ts`, imported only by API routes and scripts. Atomic multi-statement writes use `db.batch`. `npm run db:push` uses the direct `DATABASE_URL_UNPOOLED`. Tables: `firm_settings` (currency, timezone; the name comes from Clerk), `depots`, `cars`, `pay_rates` (`user_id` null = the firm default), `shifts` (one per courier per day). When `db:push` can't run because it asks interactively (e.g. whether a table was renamed), push in two passes: without the new table, then with it. `.env.local` points at the Neon `dev` branch (main's URLs are kept as comments); the seed data lives there.
- **Business logic** (permissions, approvals, salary math): code in API routes and shared utils, never in the client alone. Shared domain code lives in `src/domain/` (types, `shift.ts` rules and input parsing, `salary.ts`, `dates.ts`, `calendar.ts` Monday-first month grid and month stats): pure, no React, only type imports between files, so API routes, the app and Node scripts (`node --no-warnings scripts/check-salary.mjs`) all run it.
- **API:** routes call helpers in `src/server/` (`courierContext` / `requireCourier`: Clerk session via `@clerk/backend` → active org → role, then firm settings and the firm's today) before any work, and return `{ error: code }` (`ApiErrorCode` in `src/domain/types.ts`) without details. Every shift query goes through `mine()` (firm + user). Courier routes: `GET|POST|PATCH /api/shifts/today`, `POST /api/shifts/today/submit`, `GET|PATCH /api/shifts/:id` and `POST /api/shifts/:id/submit` (own shift; fix and resubmit when rejected), `GET /api/home`, `GET /api/calendar?month=YYYY-MM`. Reviewer routes (`reviewerContext`: dispatcher or owner, scoped by `inScope()` to the firm and the dispatcher's depots; out of scope answers 404): `GET /api/approvals?view=pending|reviewed`, `GET|POST|PATCH /api/approvals/:id` (detail with pay and history; approve/reject; correct), `GET /api/team` (owners: every `org:courier` member plus anyone with shifts; dispatchers: couriers with shifts in their depots; no pay), `GET /api/team/:userId?month=` (that courier's in-scope month). Owner routes (`ownerContext` / `requireOwner`, everyone else gets `role`): `GET /api/fleet` (every depot with its cars, archived included), `POST /api/fleet/depots|cars`, `PATCH /api/fleet/depots/:id|cars/:id` (rename or move, or `{ archived }` to archive/restore; never delete), `GET|POST /api/pay-rates` (firm default and every courier's entries; schedule an entry), `PATCH|DELETE /api/pay-rates/:id` (upcoming entries only, else `notEditable`). `GET /api/home` also returns the courier's own `rate` (current and next). The app calls them with `useApi()` from `src/api/client.ts` (relative URLs, bearer token; failures become codes, `offline` when no answer).
- **Home data** comes from `useHomeSummary()` in `src/home/` (`GET /api/home`). Roles without their own screens yet get a "coming soon" `Notice`.
- **Shift form** (Shifts tab, `src/app/(app)/shifts/`) uses `useTodayShift()` from `src/shifts/today-shift.tsx`, shared with the `shifts/finish` form sheet. Phases: not started → in progress → submitted. Edits autosave 800 ms after typing, with a status line and Retry; typed values never get replaced by a failed save. Below it sits the month calendar (`src/components/calendar/`, `useCalendar()` from `src/calendar/`), which the Team tab reuses for one courier; the review detail and reject sheet live in `src/components/approvals/` so the Approvals and Team stacks share them. Profile is a stack (`src/app/(app)/profile/`): owners get Depots & cars there (`useFleet()` from `src/fleet/`, add/edit form sheets in `src/components/fleet/`) and Pay rates (`usePayRates()` from `src/pay-rates/`, screens in `src/components/pay-rates/`). Dates are picked with `DateField` (`src/components/date-field.*`: `@expo/ui` native pickers on iOS/Android, a text field on web). Calendar marks: approved `secondary-ink`, submitted `primary`, rejected `danger`, today or draft outlined. Swipe uses core `PanResponder` (there is no `GestureHandlerRootView`).
- **Languages:** English, Bulgarian, and German. Every UI string comes from translation files, never hardcoded in a screen. The device language picks the default.
- **Connectivity:** online only. No offline storage or sync for now. When there's no connection, show a clear error and keep what the courier typed on screen.

## Domain

- **Firm:** a tenant (Clerk Organization). It holds its own name, logo, currency, and timezone. Never hardcode "Ivanov Transport" or any other firm's details.
- **Depot (station):** belongs to a firm. Couriers and cars are assigned to depots. A dispatcher manages one or more depots.
- **Car:** belongs to a firm and has a plate number and a depot. A shift records which car was driven.
- **Managing depots and cars** is owner-only. Depot names are unique per firm ignoring case, plates are stored normalised (trimmed, uppercase, single spaces; letters of any script, digits, `-`, up to 15) and unique per firm. Archived rows keep their name or plate, so restore instead of re-creating. A depot can't be archived while it has active cars, and a car can't be restored or moved into an archived depot. Archiving only hides a row from new picks; shifts keep it.
- **Shift:** one courier, one day, one depot. Records start and finish time, start and end km (driven = end − start), packages loaded, returned, and pickups (Abholung, customer returns), and the car. Delivered is never typed: it is loaded − returned, and returned can't exceed loaded. Status moves `draft → submitted → approved` or `rejected` (reason codes `km`, `packages`, `busOrStation`, `time` plus an optional note). The courier edits a shift only while it is `draft` or `rejected`; resubmitting keeps its times. Dispatchers approve or reject submitted shifts and correct submitted or approved ones (status unchanged). Reviews set `reviewed_at`/`reviewed_by`; each corrected field writes a `shift_changes` row in the same transaction, and the shift shows as "Corrected".
- **Salary:** each courier is paid either hourly (approved minutes × rate, rounded per shift half up, minor units) or with a day rate (a fixed amount per approved shift, however long), never both. The owner sets a firm default and per-courier overrides. On a given day, the courier's latest own entry on or before it applies, else the firm default's latest; a `firm` entry means "follow the firm default" again. Every entry has a start date (a firm calendar day), so a change never rewrites days before it. Past start dates are allowed after a warning and change approved pay. Only upcoming entries can be edited or cancelled. Every entry records who set it and when. Couriers see only their own rate. Monthly totals are computed from approved shifts only, never stored as fixed numbers. Months are never locked: correcting an approved shift, even in a paid month, updates that month's total. Every correction records who changed what and when.

### Who sees what

| Role       | Can see                                   | Can change                                         |
|------------|-------------------------------------------|----------------------------------------------------|
| courier    | own shifts, own hours, salary, and pay rate | own draft or rejected shifts                     |
| dispatcher | shifts, cars, and shift pay in their depots (`dispatcher_depots`), never the rate lists | approve, reject, or correct shifts in their depots |
| owner      | everything in the firm, including salaries | depots, cars, users, rates, firm settings          |

## Rules

- **Tenant isolation:** every firm-owned table has a `firm_id`, and every query filters by it. The firm and role come from the verified Clerk session, never from the request body or URL.
- API routes verify the Clerk session, then check role and depot access, before doing any work. Hiding a button in the UI doesn't count as a permission check.
- SQL always uses parameters. Never build queries by joining strings with user input.
- Schema changes go to the database only with `drizzle-kit push`, from the Drizzle schema in git. Never generate, write, or run migration files (no `drizzle-kit generate` or `migrate`, no migrations folder or migration scripts). Push to a Neon branch first, then to the main branch.
- **Development project:** there is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort keeping old data working. Every schema change means a clean state.
- Money is stored as integers in minor units (stotinki, cents) with the firm's currency code. Working time is stored in minutes. Never store money in floats.
- Calendar days and months follow the firm's timezone. Store timestamps in UTC.
- Never hard-delete couriers, cars, depots, or shifts that salary history depends on. Archive them instead.
- Salaries are personal data. Never log them, and never return them to roles that can't see them.
- Secret keys (Clerk secret key, `DATABASE_URL`) never reach the app bundle. Use them only in API routes and local scripts such as seeding. Never put them behind `EXPO_PUBLIC_`, which is bundled into the app. Never commit `.env`. Keep variable names, without values, in `.env.example`.
- Ask before adding a dependency or service. Prefer Expo modules over third-party libraries.
- Whenever you need input from the user, ask through your tool's built-in question panel so they pick from options instead of typing. Give two to four clear options with the recommended one first. Fall back to plain text only if no such panel exists.

## How we build features

For a new feature or a change across several files. Small fixes and questions skip this.

1. **Understand.** Read the code involved. Open an earlier plan only if this feature builds directly on it (pick by file name). Read the current docs pages for the APIs you'll use, and load a matching skill if one exists (e.g. the Expo, Clerk, or Neon skills). Don't write version-specific APIs from memory.
2. **Ask.** If a real decision is unclear (scope, visible behavior, data shape, who may see or change what), ask in the question panel, batching questions into one round and following up only if the answers raise new ones. Pick defaults for the rest and list them. If a decision in this file looks wrong, raise it instead of changing it.
3. **Plan.** Copy `prompts/TEMPLATE.md` to `prompts/NN-feature-name.md` (next number) and fill it in. The plan must be self-contained, so a fresh session can build it from this file plus the plan alone.
4. **IMPORTANT: stop and wait.** Write no app code until the user approves the plan. Ask for approval in the question panel (approve, or request changes). If they request changes, update the plan and ask again. On approval, set `Status: approved`.
5. **Build** step by step, checking each one. If a step turns out wrong, stop and explain instead of redesigning.
6. **Close out.**
   - Run the plan's Verification and give the report described under Reporting.
   - Add a short `## Result` to the plan and set `Status: done`.
   - Update this file: put each lasting decision in the section it belongs to. Replace or remove rules that are no longer true instead of appending. Keep this file under 150 lines.

## Building from designs

Designs are attached in the chat. Screens must match them exactly: layout, spacing, sizes, colors, type, radii, icons, and copy. The design system reference is the Route Forge Design Board (`https://claude.ai/artifact/4x1GGuAYpH6XjXYM3hQ3mu`), with panels numbered 01–15. Its icons are stand-ins; the app uses native symbols.

- Icons, fonts, and brand images come from `assets/` or the chosen icon library, never recreated from a screenshot. Firm logos come from firm settings, not from `assets/`. If an asset is missing, use a marked placeholder and list it.
- Map every color, font, spacing value, and radius to a design-system token. List values with no token in the plan as proposed new tokens instead of hardcoding them. When creating the design system itself, derive the tokens from the designs.
- UI plans describe the design (elements, states, tokens, assets) well enough to build without the image. If building in a new session, ask for the design to be attached again.
- After building, open the screen in the iOS simulator (deep link with `xcrun simctl openurl booted <url>` when it isn't the first screen; the scheme is in `app.json`), take a screenshot (`xcrun simctl io booted screenshot <path>`), and compare it with the design. List every difference, fix, and repeat. Report which values were estimated from an image.

## Reporting

End every piece of work that changes code (features and fixes, not answers to questions) with this report. Use these headings in this order, and leave out any section that would be empty.

- **Done:** one line on the outcome, then the files changed and what changed in each.
- **Verified:** each check with ✅ or ❌ and its evidence (command output, screenshot). List what wasn't checked as ❌ with the reason. Never mark something ✅ without running it.
- **You need to:** numbered actions only the user can take, such as keys, Clerk or Neon dashboard settings, or assets to provide.
- **Test it yourself:** numbered steps to reproduce the result from a fresh start, ending with `Expected:` and what the user should see.
- **Notes:** defaults picked, trade-offs, and anything left for later.

## Checks

- Lint and type check pass before any task is called done.
- Screens that load data handle loading, error, empty, and offline states.
- New UI text exists in English, Bulgarian, and German.
- Auth flows are tested with Clerk test emails (any address containing `+clerk_test`, code `424242`), which send no real email.
- Every new API route is tried as each role and as a user from a second firm. A courier can't read another courier's data, a dispatcher can't reach depots outside their own, and no firm sees another firm's data.
- Salary changes are checked against a hand-calculated example month, including a mid-month rate change and a rejected shift.
