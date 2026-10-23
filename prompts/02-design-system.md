# 02 · Design system

Status: done

## Goal
Every screen draws from one visual source: Route Forge tokens (colors with light and dark values, type, spacing, radii, shadows, control sizes), the brand fonts, and a small set of shared primitives (text, icon, button, icon button, text field, chip, tag, alert, segmented control, stepper, toggle, surface). The tokens and primitives match the "Route Forge Design Board" (`https://claude.ai/artifact/4x1GGuAYpH6XjXYM3hQ3mu`, panels 01–15), and a dev-only showcase screen renders them for comparison.

## Decisions
- **Storage:** tokens live in `src/global.css` as Tailwind v4 `@theme` variables, following the NativeWind v5 docs (the `expo-design-system` skill's Tailwind rule). No parallel `src/theme/` token files. JS reads colors through one hook (see the colors step), never through hex literals.
- **Tailwind defaults are cleared:** `--color-*`, `--text-*`, `--radius-*`, and `--shadow-*` are reset to `initial`, so `text-orange-500`, `rounded-xl`, and similar classes stop compiling. Only Route Forge tokens exist.
- **Spacing:** `--spacing: 4px`. NativeWind's `rem` is 14 on native and 16 on web, so the default `0.25rem` would differ by platform. With 4px, `p-1`…`p-8` give the board's 4-pt scale (4, 8, 12, 16, 20, 24, 32) on every platform. Screen edge padding is `px-4` (16).
- **Dark mode:** follows the system (`userInterfaceStyle: "automatic"` is already set). Dark values override the color variables inside `@media (prefers-color-scheme: dark) { :root { … } }`. `:root.dark`-style selectors are rejected on native, so none are used. There's no in-app theme toggle for now.
- **Fonts:** Plus Jakarta Sans for English and German, Manrope for Bulgarian (Plus Jakarta Sans has no Cyrillic, and React Native has no font fallback stacks). Five static weights each: 400, 500, 600, 700, 800. Variable fonts aren't used.
- **Font files:** static TTFs (SIL OFL) copied into `assets/fonts/`, renamed to their PostScript names, with `OFL.txt` license files beside them. They're loaded at runtime with `useFonts` from the installed `expo-font`, so they work in Expo Go and on web. No new dependency. The files are taken from the `@expo-google-fonts/plus-jakarta-sans` and `@expo-google-fonts/manrope` npm tarballs (`npm pack` into a scratch folder). The packages aren't installed.
- **Font by language:** the `ThemedText` and `TextField` primitives choose the font family from a `FontScriptProvider` context (`"latin"` or `"cyrillic"`). Until the i18n plan exists, the root layout sets it from the device locale (`Intl.DateTimeFormat().resolvedOptions().locale` starts with `bg` → cyrillic). The i18n plan will switch it to the app language. Cyrillic text such as courier names in an English UI renders in Plus Jakarta Sans, which falls back to the system font for those glyphs. This is accepted.
- **Weight comes from the family, not `fontWeight`:** each weight is its own family (`PlusJakartaSans-Bold`), per NativeWind's custom fonts guide. Screens never use `font-bold` and similar classes. They pick a `ThemedText` variant.
- **Icons:** `expo-symbols` (already installed, included in Expo Go): SF Symbols on iOS, Material Symbols on Android and web. One registry, `src/components/icons.ts`, maps the board's icon names to a symbol per platform. Screens use `<Icon name="package" />`, never raw symbol names. Native symbols replace the board's hand-drawn 1.8-stroke icons, so the icons will look different from the board.
- **Toggle:** the board's toggle (52×32, amber when on) is the native `Switch` tinted with tokens, not a custom-drawn control (the skill says not to re-implement native controls).
- **Primitives take all text as props.** None hold UI strings, so the "every string comes from translation files" rule stays with the screens. Icon-only controls require an `accessibilityLabel` prop.
- **Showcase screen:** `src/app/design-system.tsx` renders every token and primitive in light and dark mode for visual checks. It's dev-only: it redirects to `/` when `!__DEV__`. Its sample copy is English and hardcoded, which is an explicit exception to the translations rule because it never ships. The placeholder `index.tsx` gets a dev-only link to it.
- **Pressed states** aren't on the board. Defaults: filled controls go to `opacity-85` when pressed, and outlined or ghost controls get `bg-canvas`. Disabled is `opacity-40`. Every tappable primitive has pressed feedback.
- **`tabular-nums` is web-only in NativeWind.** Numbers on native use the font's default figures. This is accepted.

### Tokens (from the board; ≈ marks values estimated or snapped)

**Colors** — `@theme` name → light / dark

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | #F5B82E | #F7C14B | primary actions, active tab, depot chip |
| `on-primary` | #14161C | #14161C | text and icons on amber |
| `primary-soft` | #FDF1D3 | #3A2F14 | highlight tag |
| `secondary` | #C9D3F0 | #34426B | selected status chip |
| `secondary-soft` | #EEF1FA | #1F2638 | focus ring, action card, firm slot |
| `secondary-ink` | #3B4C7E | #BAC7EF | text on secondary, focus border |
| `ink` | #11141C | #F1F3F7 | headings, primary text, numbers |
| `ink-muted` | #6A7180 | #9CA3B1 | body, captions, placeholders |
| `surface` | #FFFFFF | #191C22 | cards, sheets, focused/error fields |
| `canvas` | #F4F5F7 | #101216 | app background, fields, chips, icon buttons |
| `border` | #E4E6EB | #2A2F38 | dividers, outlines, toggle off track |
| `glass` | rgba(255,255,255,0.70) | rgba(30,33,40,0.62) | tab bar, overlays (later plans) |
| `success` / `success-soft` | #2E9E5B / #E6F4EC | #4CC27C / #16291F | approved |
| `danger` / `danger-soft` | #D9443A / #FCEBEA | #F06A60 / #331A19 | rejected, errors, destructive |
| `info` / `info-soft` | #3B4C7E / #EEF1FA | #BAC7EF / #1F2638 | submitted, "corrected" |
| `neutral` / `neutral-soft` | #6A7180 / #EEF0F3 | #9CA3B1 / #23272F | draft, offline |
| `inverse` / `on-inverse` | #11141C / #FFFFFF | #F1F3F7 / #11141C | selected segment |
| `white` | #FFFFFF | #FFFFFF | glyphs on status badges (new: fixed white) |
| `transparent` | transparent | transparent | resting field border |

**Type** — `--text-<name>` with `--line-height` and `--letter-spacing` sub-tokens (px; RN has no `em` tracking, so −3.5% of 36 = −1.26)

| Variant | Size / line height | Weight | Tracking | Default color | Board use |
|---|---|---|---|---|---|
| `display` | 36 / 38≈ | 800 | −1.26 | ink | screen hero ("Log today's shift") |
| `number` | 28 / 32≈ | 800 | −0.84 | ink | hours, totals |
| `heading` | 22 / 26≈ | 700 | −0.44 | ink | section and depot titles |
| `title` | 17 / 20≈ | 800 | −0.34 | ink | card titles (new token, from 07) |
| `button` | 16 / 20≈ | 700 | 0 | ink | button labels, stepper value |
| `body` | 15 / 22≈ | 400 | 0 | ink-muted | paragraphs (board spec says 15; its CSS uses 14) |
| `label` | 13 / 18≈ | 600 | 0 | ink | chips, rows, segments, toggles (new; 13.5 snapped to 13) |
| `caption` | 13 / 18≈ | 500 | 0 | ink | plate · depot, alerts |
| `footnote` | 12 / 16≈ | 600 | 0 | ink-muted | meta, stats, tags, field hints (new; 12.5 and 11.5 snapped to 12) |
| `micro` | 11 / 14≈ | 600 | 0 | ink | tab labels, small tags (new; 11.5 and 10 snapped to 11) |

**Fonts** — `--font-<family>-<weight>` → `font-jakarta-bold` etc. Families: `PlusJakartaSans-{Regular,Medium,SemiBold,Bold,ExtraBold}` and `Manrope-{Regular,Medium,SemiBold,Bold,ExtraBold}`.

**Radii:** `sm` 10, `md` 14, `lg` 20, `full` 9999. Stray board values snap to these: 9 and 12 → `sm`, 15 → `lg` (≈).

**Control sizes** (new, as `--spacing-<name>` so `h-button` and `size-icon-button` work): `button` 54, `button-sm` 34, `ghost` 44, `icon-button` 50, `field` 52, `chip` 38, `segment` 38, `tag` 30, `tag-sm` 24, `stepper-button` 34, `alert-badge` 26. Minimum touch target 44: smaller controls (`button-sm`, `stepper-button`) get `hitSlop`.

**Shadows** (`@utility`, dark variant via media query):
- `shadow-card`: light `0 1px 2px rgba(17,20,28,.04), 0 4px 16px rgba(17,20,28,.05)`, dark `0 1px 2px rgba(0,0,0,.3)`
- `shadow-floating`: `0 6px 24px rgba(17,20,28,.10)` (tab bar, later)
- `shadow-focus`: `0 0 0 4px` + `secondary-soft` (focused field ring)

**Icon sizes:** 22 default, 18 `sm`, 15 `xs`.

**Not tokens:** the board's page chrome (`--board`, panel padding 18) and the mono token labels.

## Out of scope
- Feature components that appear only with their screens: 07 shift card, 08 action card, 09 profile row, 10 glass tab bar. They're built in their feature plans from these tokens and primitives.
- 01 brand: app icon, splash, wordmark, and the firm logo slot. `app.json` splash and adaptive-icon colors stay as they are.
- i18n setup and translation files. The font script comes from the device locale until then.
- An in-app light/dark/system switch.
- Motion tokens (added with the first animation).
- iOS simulator screenshots: this machine runs Windows (see Verification).

## Steps
### 1. Fonts in assets
In a scratch folder outside the repo, run `npm pack @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/manrope` and extract both. Copy the static 400, 500, 600, 700, and 800 TTFs into `assets/fonts/`, renamed to their PostScript names (`PlusJakartaSans-Regular.ttf`, `PlusJakartaSans-Medium.ttf`, `PlusJakartaSans-SemiBold.ttf`, `PlusJakartaSans-Bold.ttf`, `PlusJakartaSans-ExtraBold.ttf`, and the same five for `Manrope-*`). Add each family's OFL license as `assets/fonts/PlusJakartaSans-OFL.txt` and `assets/fonts/Manrope-OFL.txt`. Check that the Manrope files include Cyrillic (render "Подай смяната" in step 7). Done when there are 10 TTFs and 2 license files, and nothing was added to `package.json`.

### 2. Tokens in `src/global.css`
After the existing imports, add:
- `@theme { … }` resetting `--color-*`, `--text-*`, `--radius-*`, and `--shadow-*` to `initial`, then defining `--spacing: 4px`, every color (light values), every type token with sub-tokens, the font families, the radii, and the control sizes from the Tokens section.
- `@media (prefers-color-scheme: dark) { :root { … } }` overriding each color variable with its dark value.
- `@utility shadow-card`, `shadow-floating`, and `shadow-focus`, each with its dark media override where the board has one.

Then verify that dark mode reaches native before building anything on it. Run `npx expo export --platform ios` and `--platform web`, and check that both the light and dark hex values for `--color-ink` appear in the output. If the native output has only the light values (inlined), add the color variables to `inlineVariables.exclude` in `metro.config.js` (NativeWind's documented fix) and check again. If that doesn't work, stop and report.

### 3. Colors in JS
Add `src/theme/use-theme-color.ts`: `useThemeColor(token)` returns the current value of `--color-<token>`, using NativeWind's `useUnstableNativeVariable` on native and `getComputedStyle` on web. The token argument is a union type of the color names. It's for props that can't take a `className`, such as `Switch` track colors, `ActivityIndicator`, and navigation options. Check in the showcase that it switches with the system theme. If it doesn't, stop and report rather than adding a hand-kept copy of the palette.

### 4. Fonts and theme in the root layout
In `src/app/_layout.tsx`: call `SplashScreen.preventAutoHideAsync()`, load all 10 families with `useFonts`, return `null` until loaded or errored, then hide the splash. Wrap the stack in `FontScriptProvider` (`src/theme/font-script.tsx`, exporting the provider and `useFontScript()`), with the script derived from the device locale. Set the stack's `contentStyle` background to `useThemeColor("canvas")`. Add `<StatusBar style="auto" />`.

### 5. `ThemedText` and `Icon`
- `src/components/themed-text.tsx`: `variant` (default `body`) maps to a literal className string for size and color. The family class comes from a literal map of `{ latin, cyrillic } × weight` (`font-jakarta-extrabold` / `font-manrope-extrabold`), so Tailwind can see every class. An optional `weight` overrides the variant's weight. `className` merges last.
- `src/components/icons.ts`: the registry, typed with expo-symbols' `SFSymbol` and Android symbol types. Board name → iOS / Material: home `house`/`home`, hours `clock`/`schedule`, packages `shippingbox`/`package_2`, km `gauge.with.dots.needle.50percent`/`speed`, car `truck.box`/`local_shipping`, depot `building.2`/`warehouse`, shifts `calendar`/`calendar_month`, salary `creditcard`/`account_balance_wallet`, approvals `tray`/`inbox`, profile `person`/`person`, settings `gearshape`/`settings`, offline `wifi.slash`/`wifi_off`, search `magnifyingglass`/`search`, filter `slider.horizontal.3`/`tune`, check `checkmark`/`check`, close `xmark`/`close`, alert `exclamationmark`/`priority_high`, chevron `chevron.right`/`chevron_right`, arrow `arrow.right`/`arrow_forward`, plus `plus`/`add`, minus `minus`/`remove`, lock `lock`/`lock`, hide `eye.slash`/`visibility_off`, list `list.bullet`/`list`, doc `doc.text`/`description`, language `globe`/`language`, sign-out `rectangle.portrait.and.arrow.right`/`logout`, pin `mappin`/`location_on`, route `point.topleft.down.to.point.bottomright.curvepath`/`route`. Web uses the Material names.
- `src/components/icon.tsx`: `<Icon name size="md|sm|xs" className />` wraps `SymbolView` with NativeWind's `styled`, mapping the text `color` from `className` to `tintColor` (default `text-ink`). Icons are decorative (`accessible={false}`) unless given a label.

Done when the showcase renders every icon on web and both scripts in every variant.

### 6. Controls
All primitives live in `src/components/`, one kebab-case file each, follow the skill's contract (variant, size, states, `className` merged last, accessibility role and state), and use only tokens.
- `button.tsx`: `variant` is `primary` (`bg-primary`, `on-primary` text, optional trailing icon pinned 20 from the right), `secondary` (`bg-surface border border-border`, ink text), or `destructive` (ghost, `danger` text, `h-ghost`, `button` text at 15≈). `size` is `md` (`h-button`, full width, `rounded-full`, `button` text) or `sm` (`h-button-sm`, `px-4`, 13 bold). It has pressed, disabled, and `loading` states (spinner in the text color via `useThemeColor`, label kept as `accessibilityLabel`, `busy` state set).
- `icon-button.tsx`: `size-icon-button rounded-full`. `variant` is `default` (`bg-canvas`, ink) or `primary` (`bg-primary`, on-primary). Requires `accessibilityLabel`.
- `text-field.tsx`: wraps `TextInput`. Container is `h-field rounded-md bg-canvas px-3.5 gap-3`, with a 1.5px transparent border (an inline arbitrary value with a comment; no token). Optional leading `icon` (sm, ink-muted) and `trailing` node. The value uses `caption`-weight 500 at 15, with `placeholder:text-ink-muted`. Focused (tracked with onFocus/onBlur): `border-secondary-ink bg-surface shadow-focus`. With `error` (string): `border-danger bg-surface`, and the message renders below as `footnote` in `danger`, offset 4 from the left. Passing `secureTextEntry` adds a show/hide `IconButton`-style toggle whose labels are props. Requires `accessibilityLabel` (the board has no visible field labels).
- `chip.tsx`: `h-chip px-4 rounded-full bg-canvas`, `label` text, optional `xs` icon with `gap-2` (7≈). `selected` with `tone="secondary"` (`bg-secondary`, `secondary-ink` text) or `tone="primary"` (`bg-primary`, on-primary). Uses the `button` role and `selected` state.
- `segmented-control.tsx`: `options: { value, label, icon? }[]`, `value`, `onChange`. Track `bg-canvas rounded-full p-1 gap-0.5`. Segments are `h-segment rounded-full` with `label` text. The selected one is `bg-inverse` with `on-inverse` text. Uses the `tab` role inside a `tablist`, with `selected` state.
- `stepper.tsx`: `value`, `onChange`, `min`, `max`, `step`, plus `decrementLabel` and `incrementLabel` props. Track `bg-canvas rounded-full p-0.75`. Buttons are `size-stepper-button rounded-full bg-surface` with `hitSlop` to 44. The value is `button`-variant ExtraBold 16 with a min width of 46. Exposes the `adjustable` role with increment/decrement accessibility actions.
- `toggle.tsx`: native `Switch` with `trackColor={{ false: border, true: primary }}` and a white thumb via `useThemeColor`. Takes all other `Switch` props.

### 7. Display primitives and showcase
- `tag.tsx`: `tone` is `draft` (neutral on neutral-soft), `submitted` (info on info-soft), `approved` (success on success-soft), `rejected` (danger on danger-soft), `role` (ink on canvas, `border-border`), or `highlight` (ink on primary-soft). Status tones show an 8≈ (board 7) dot in the text color. `size` is `md` (`h-tag px-3`, `footnote`) or `sm` (`h-tag-sm px-2.5`, `micro`). `rounded-full`.
- `alert.tsx`: `tone` is `success`, `danger`, or `offline`. Container is `rounded-md p-3 pl-3.5 gap-2.5` on the tone's soft background (danger text is `danger`). The leading `size-alert-badge rounded-full` badge holds a white `xs` icon (check, alert, offline) on the tone color. The message is `caption`. Optional `onDismiss` with `dismissLabel` renders a close icon in `ink-muted`. Uses the `alert` role, with a polite live region on Android.
- `surface.tsx`: `bg-surface`. `variant` is `raised` (`rounded-lg shadow-card`) or `outlined` (`rounded-lg border border-border`). Children decide their own padding. Use it only for real cards, not for every row.
- `src/app/design-system.tsx`: dev-only showcase, sectioned like the board (02 palette, 03 type in both scripts, 04 buttons, 05 fields in default/focused/error/password states, 06 chips, 11 icons, 12 segmented, 13 toggles and stepper, 14 alerts, 15 tags), on `bg-canvas` with `px-4`, in a `ScrollView`. Update `src/app/index.tsx` to tokens (`bg-canvas`, `ThemedText`), keeping the placeholder copy, plus a `__DEV__`-only link to `/design-system`.

## Verification
- `npx tsc --noEmit` and `npx expo lint` pass.
- `npx expo export --platform ios` and `--platform web` bundle. The output contains both light and dark color values, and the old palette classes (`text-orange-500`) no longer compile.
- Drift grep: no hex color, `#`-literal, `fontSize`, or `fontFamily` in `src/` outside `src/global.css` (allowed: the 1.5px field border comment).
- Web (`npx expo start --web`, `/design-system`), in light and in dark (system setting): each section matches the board's panel side by side. Fonts are Plus Jakarta Sans. With a `bg` browser locale, all text is Manrope and Cyrillic renders in Manrope. Focus, error, pressed, disabled, and loading states all show. If a browser tool is available, screenshot both themes and list every difference from the board.
- Screen reader spot check on web: icon buttons, stepper, and field announce their labels.
- iOS simulator screenshots, as AGENTS.md asks, need a Mac. This machine runs Windows, so this is marked ❌ and handed to the user: open `routeforge:///design-system` in Expo Go on a phone in both themes and compare with the board.

## AGENTS.md updates
- Expo section, replacing the styling line's tail: "Design tokens live only in `src/global.css` (`@theme`, dark values under `prefers-color-scheme`). Tailwind's default palette, type scale, radii, and shadows are removed, so use Route Forge tokens (`bg-canvas`, `text-ink`, `rounded-md`, `h-button`). Spacing is a 4px step (`p-4` = 16). In JS, read colors with `useThemeColor`, never hex."
- New bullets in Expo: "Text goes through `ThemedText` variants, never `font-bold`/`text-[n]`. Fonts: Plus Jakarta Sans (EN, DE) and Manrope (BG), static weights loaded with `useFonts` in the root layout; `FontScriptProvider` picks the family." and "Icons: `expo-symbols` through `<Icon name>` and the registry in `src/components/icons.ts`. Add new icons to the registry with an iOS and an Android name."
- Building from designs: "The design reference is the Route Forge Design Board (`https://claude.ai/artifact/4x1GGuAYpH6XjXYM3hQ3mu`); its panels are numbered 01–15. Shared primitives are in `src/components/`; check them before building a new control."

## Result
Built as planned: 10 static fonts (PostScript names checked, Manrope has Cyrillic, Plus Jakarta Sans doesn't), tokens in `src/global.css`, `useThemeColor`, the font script context, and 12 primitives plus the dev showcase. Type check, lint, iOS and web exports pass. All 118 classes used compile on both platforms, and the default Tailwind palette no longer compiles. The native compiler keeps the color variables live with their dark values, so no `inlineVariables.exclude` was needed. Checked on web in headless Edge (light, dark, `bg-BG` locale) with screenshots; not checked on iOS or Android.

Deviations:
- `Icon` takes a `color` token prop instead of a text-color `className`: on web a className becomes CSS and never reaches `tintColor`.
- `ThemedText` takes a `color` token prop; `className` is layout only. Two Tailwind color classes on one element resolve by stylesheet order, not className order, so a className can't override a variant's color.
- On web, `useThemeColor` returns `var(--color-x)` instead of a resolved hex, so server and client renders match. The native build reads the variable with `useUnstableNativeVariable` (its package types describe the web build, hence a cast).
- The font script is read with `useDeviceFontScript()` (`useSyncExternalStore`, server snapshot `latin`) to avoid a hydration mismatch when the browser locale is Bulgarian.
- The root layout themes React Navigation (`ThemeProvider` with token colors and the brand fonts) instead of setting only `contentStyle`, so headers follow the tokens and dark mode.
- `Toggle` also passes react-native-web's `activeThumbColor`. On web the switch is react-native-web's smaller drawing, not 52×32.
- `.agents/` and `prompts/` are excluded from Tailwind's class scanning (`@source not`), because the docs there mention classes the app doesn't use.
