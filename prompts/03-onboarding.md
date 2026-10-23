# 03 · Onboarding

Status: done

## Goal
A signed-out user opening the app sees three onboarding slides (photo, headline, short text), can swipe or tap through them or skip, and lands on Sign in or Create account. Those two screens are placeholders until the Clerk auth plan replaces them.

## Decisions
- No design was attached. The screen is composed from Design Board tokens and primitives only (01, 03, 04), and the user reviews it in the simulator.
- Auth targets are placeholder routes `/(auth)/sign-in` and `/(auth)/sign-up`. Clerk comes in its own plan.
- Photos are from Unsplash (free Unsplash License, no attribution required), downloaded into `assets/images/onboarding/`. They are not remote URLs, so onboarding works with no network. Credits are kept in `assets/images/onboarding/CREDITS.md`.
- i18n: `expo-localization` + `i18n-js` (new dependencies, approved). Languages en, bg, de. The device language picks the language, and anything else falls back to en.
- No "seen onboarding" flag. Onboarding is the signed-out entry, and once auth exists a signed-in user skips it. This avoids storage the app doesn't otherwise need (online only).
- The pager is a horizontal `ScrollView` with `pagingEnabled`, so no pager library is needed.
- `FontScriptProvider` now follows the app language (bg → Manrope) instead of the raw device locale.
- No new design tokens: every value maps to an existing token.

## Out of scope
Clerk, real sign-in/sign-up, firm invitations, an in-app language switcher, persisting onboarding state, animations beyond native scroll paging.

## Design (built without an image)
Screen `src/app/onboarding.tsx`, `bg-canvas`, inside the safe area (top and bottom).

1. **Top bar** (`h-ghost` = 44, `px-4`, row, space-between):
   - Brand: `size-8` square, `rounded-sm`, `bg-primary`, `<Icon name="route" color="on-primary" size={18}>` centered (placeholder mark, as on the board), then `gap-2` and the wordmark `routeforge` in `ThemedText variant="title"`.
   - Right: "Skip" (`variant="label"`, `color="secondary-ink"`, `hitSlop` to 44). It jumps to the last slide and is hidden (kept in layout, `opacity-0`, not pressable) on the last slide.
2. **Pager** (`flex-1`, `mt-2`): three pages, each the window width.
   - Photo: `mx-4 flex-1 rounded-lg overflow-hidden bg-neutral-soft`, `expo-image` `contentFit="cover"`, `transition` skipped on cache hit. A `Tag`-style glass pill sits at the photo's bottom-left (`m-4`, `bg-glass`, `rounded-full`, `h-tag`, `px-3`) with an icon and an eyebrow (`variant="label"`).
   - Text block `px-4 pt-6`: headline `variant="display"` (max 2 lines), then `mt-3` body `variant="body"` (ink-muted).
3. **Footer** (`px-4 pt-6 pb-2`, `gap-4`):
   - Dots, centered row, `gap-2`: active `h-2 w-6 rounded-full bg-primary`, inactive `size-2 rounded-full bg-border`. Each dot is pressable and scrolls to its page. The group's accessibility label is "Step n of 3".
   - Primary `Button`: "Next" + `trailingIcon="arrow"` on slides 1–2 (scrolls forward). On slide 3: "Sign in" → `/sign-in`.
   - A ghost row under it (`h-ghost`, centered `ThemedText variant="body" weight="semibold" color="secondary-ink"`): "New here? Create an account" → `/sign-up`, shown on every slide.

Slides (EN copy; BG and DE in locale files):
| # | Photo | Eyebrow (icon) | Headline | Body |
|---|-------|----------------|----------|------|
| 1 | `log.jpg`, amber van being loaded (Unsplash `a85IYeAXgxU`) | Hours · packages · km (`hours`) | Log the day in a minute | Hours, packages, kilometers and the car you drove. One shift, one screen. |
| 2 | `approve.jpg`, courier on the street with parcels (`brizG9kR6qI`) | Dispatcher check (`approvals`) | Your dispatcher checks it | Send your shift and see when it's approved, or what to fix if it comes back. |
| 3 | `pay.jpg`, parcel handover (`BFdSCxmqvYc`) | Hourly pay (`salary`) | Get paid right | Your pay follows your approved hours, so every month adds up. |

Placeholder auth screens `src/app/(auth)/sign-in.tsx` and `sign-up.tsx`: native Stack header with a back button and the translated title, then a `bg-canvas` body with `px-4 pt-6`, a `heading`, a `body` line saying sign-in arrives soon, and a secondary `Button` "Back to start" → `router.dismissTo("/onboarding")`.

Estimated, not from a design: every size and spacing above, chosen from the 4-pt scale and board components.

## Steps
### 1. i18n foundation
`npx expo install expo-localization i18n-js`. Add the `expo-localization` plugin to `app.json` with `supportedLocales: ["en", "bg", "de"]`. Create `src/i18n/locales/{en,bg,de}.json` (nested keys: `app`, `onboarding`, `auth`) and `src/i18n/index.ts`, exporting:
- `Language = "en" | "bg" | "de"`.
- `useLanguage()`: `useSyncExternalStore` with an `AppState` "active" subscription (Android can change locale while running). The client snapshot is the first `getLocales()` languageCode that is supported, else `"en"`. The server snapshot is `"en"`, so web SSR's first render is stable.
- `useTranslation()`: returns `t(key, options)` calling one shared `I18n` instance with `{ locale: language }`, never mutating a global locale. `enableFallback = true`, default locale en.
In `src/theme/font-script.tsx` replace `useDeviceFontScript` with `fontScriptFor(language)`, and in `_layout.tsx` use `fontScriptFor(useLanguage())`. Done when tsc, lint and the design-system screen still work.

### 2. Photos
Download the three photos by their Unsplash IDs (`https://unsplash.com/photos/<id>/download?force=true`, then request the image URL with `w=1200&q=80&fm=jpg`) into `assets/images/onboarding/{log,approve,pay}.jpg`, each under ~250 KB. Write `CREDITS.md` with the photographer, photo URL and license. Check that none shows a brand logo.

### 3. Onboarding screen and routes
- `src/app/index.tsx`: `<Redirect href="/onboarding" />` (later: signed in → home).
- `src/app/onboarding.tsx` per the Design section, `headerShown: false`. Track the page from `onMomentumScrollEnd` (`Math.round(x / width)`), and move with `scrollTo({ x: page * width })`. Use `useWindowDimensions` for the width.
- `src/app/(auth)/_layout.tsx` (Stack, headers on, titles from `t`) plus the two placeholder screens.
- Root `_layout.tsx`: `Stack.Screen name="onboarding" options={{ headerShown: false }}` and `index` hidden too.
Done when the flow works on iOS: swipe, Next, Skip, dots, Sign in, Create account, back.

## Verification
- `npx expo lint` and `npx tsc --noEmit` pass. `npx expo-doctor` shows no new issues.
- iOS simulator, light and dark: screenshot each slide and both auth screens, compare against the Design section, fix and repeat.
- Device language set to Bulgarian: the copy is in BG and uses Manrope, and the headlines fit in 2 lines. German too (the longest strings).
- Web (`npx expo start --web`): no hydration warning on `/onboarding`.
- End to end: cold start → slide 1 → swipe to 2 → Next → 3 → Sign in opens the placeholder → back returns to slide 3. Create account works from slide 1. Skip lands on slide 3.

## AGENTS.md updates
- Expo section: i18n is `expo-localization` + `i18n-js`. Strings live in `src/i18n/locales/{en,bg,de}.json` and are read with `useTranslation()`. The language comes from `useLanguage()` (server-stable on web) and decides the font script.
- Expo section: stock photos are downloaded into `assets/images/<feature>/` with a `CREDITS.md`, never hotlinked.

## Result
Built as planned. Onboarding (3 slides), the index redirect, and placeholder sign-in/sign-up are in place, with EN/BG/DE strings and the font script following the app language. Deviations: pages get the pager's measured height (a horizontal ScrollView gives pages no definite height, so the photo collapsed), and the page tracks `onScroll` rather than `onMomentumScrollEnd` (which doesn't fire on web). The text block has `min-h-45` so the photo keeps its size across slides. Verified on web at 393×852 in en/bg/de, light and dark. The iOS simulator check is still open (built on Windows).

Follow-up fix (Android, Expo Go): text, icons and photos were invisible. There were two causes, both from the design-system setup. (1) px line-height tokens reached native as unitless multipliers (22 × 15 = 330 dp lines), so the tokens are now `calc(px / size)` ratios. (2) NativeWind's `react-native` re-export lacks RN 0.88's `AssetRegistry`, so expo-asset couldn't load fonts or the Material Symbols icon font. `metro.config.js` now resolves the real `react-native` for `node_modules`. Verified on the Android emulator in dark mode and on web (line heights unchanged).
