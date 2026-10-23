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
```

## Expo

- Expo ships breaking changes every SDK release, so don't trust memory. Before touching an Expo, EAS, or React Native API, check the `expo` major version in `package.json` and read `https://docs.expo.dev/versions/v<major>.0.0/`. For anything else, start from https://docs.expo.dev/llms.txt and follow its links.
- Routes live in `src/app/`: every file is a screen and `_layout.tsx` files define navigators. API routes are `src/app/api/*+api.ts`. Keep components, hooks, and utils outside `src/app/`.
- `ios/` and `android/` are generated. Never create or edit them by hand; configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, switch to a development build (`npx expo run:ios`).

## Who owns what

Each tool has one job. Ask before moving a responsibility to a different tool.

- **Auth, firms, and roles:** Clerk is the source of truth. Each firm is a Clerk Organization. A user's role in that firm is a Clerk org role: `owner`, `dispatcher`, or `courier`. The app keeps its own custom auth screens. Set Clerk up through the Clerk CLI and use the Clerk skills for current Expo patterns.
- **Data:** Neon Postgres holds depots, cars, shifts, pay rates, and firm settings. Only API routes reach it, through `DATABASE_URL`. The app never talks to the database directly.
- **Business logic** (permissions, approvals, salary math): code in API routes and shared utils, never in the client alone.
- **Languages:** English, Bulgarian, and German. Every UI string comes from translation files, never hardcoded in a screen. The device language picks the default.
- **Connectivity:** online only. No offline storage or sync for now. When there's no connection, show a clear error and keep what the courier typed on screen.

## Domain

- **Firm:** a tenant (Clerk Organization). It holds its own name, logo, currency, and timezone. Never hardcode "Ivanov Transport" or any other firm's details.
- **Depot (station):** belongs to a firm. Couriers and cars are assigned to depots. A dispatcher manages one or more depots.
- **Car:** belongs to a firm and has a plate number and a depot. A shift records which car was driven.
- **Shift:** one courier, one day, one depot. Records working time, packages delivered, kilometers driven, and the car. Status moves `draft → submitted → approved` or `rejected` (with a reason). The courier edits a shift only while it is `draft` or `rejected`, and dispatchers approve or correct submitted ones.
- **Salary:** hourly only, for now. Pay = approved hours × the courier's hourly rate. Rates have an effective-from date, so a rate change never rewrites past months. Monthly totals are computed from approved shifts only, never stored as fixed numbers. Months are never locked: correcting an approved shift, even in a paid month, updates that month's total. Every correction records who changed what and when.

### Who sees what

| Role       | Can see                                   | Can change                                         |
|------------|-------------------------------------------|----------------------------------------------------|
| courier    | own shifts, own hours and salary          | own draft or rejected shifts                       |
| dispatcher | shifts, cars, and salaries in their depots | approve, reject, or correct shifts in their depots |
| owner      | everything in the firm, including salaries | depots, cars, users, rates, firm settings          |

## Rules

- **Tenant isolation:** every firm-owned table has a `firm_id`, and every query filters by it. The firm and role come from the verified Clerk session, never from the request body or URL.
- API routes verify the Clerk session, then check role and depot access, before doing any work. Hiding a button in the UI doesn't count as a permission check.
- SQL always uses parameters. Never build queries by joining strings with user input.
- Schema changes are migration files in `db/migrations/`, checked into git. Try each one on a Neon branch before running it on the main branch.
- Money is stored as integers in minor units (stotinki, cents) with the firm's currency code. Working time is stored in minutes. Never store money in floats.
- Calendar days and months follow the firm's timezone. Store timestamps in UTC.
- Never hard-delete couriers, cars, depots, or shifts that salary history depends on. Archive them instead.
- Salaries are personal data. Never log them, and never return them to roles that can't see them.
- Secret keys (Clerk secret key, `DATABASE_URL`) never reach the app bundle. Use them only in API routes and local scripts such as seeding. Never put them behind `EXPO_PUBLIC_`, which is bundled into the app. Never commit `.env`. Keep variable names, without values, in `.env.example`.
- Ask before adding a dependency or service, changing a table that already holds real data, or deleting data. Prefer Expo modules over third-party libraries.
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

Designs are attached in the chat. Screens must match them exactly: layout, spacing, sizes, colors, type, radii, icons, and copy.

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
- Every new API route is tried as each role and as a user from a second firm. A courier can't read another courier's data, a dispatcher can't reach depots outside their own, and no firm sees another firm's data.
- Salary changes are checked against a hand-calculated example month, including a mid-month rate change and a rejected shift.
