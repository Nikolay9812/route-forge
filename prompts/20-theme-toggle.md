# 20 · Light/dark toggle

Status: done

## Goal
Anyone signed in can tap a moon/sun button at the top right of Profile to switch the app between light and dark mode. The choice is remembered on the device.

## Decisions
- Placement: a round `IconButton` (`outline` variant, so it shows on `canvas`) at the top right of the Profile screen, for every role. It scrolls with the content.
- Icon shows the mode you switch *to*: moon in light mode, sun in dark mode. The accessibility label says the same ("Switch to dark mode" / "Switch to light mode").
- Behavior: the app follows the phone until the first tap. After that each tap flips light ↔ dark and saves `light` or `dark` on the device. There's no "follow phone" state in the UI (decided: two-state toggle).
- Mechanism: `Appearance.setColorScheme()` from `react-native`. `react-native-css` listens to `Appearance` change events, so the `prefers-color-scheme` tokens, `useThemeColor`, `useColorScheme()` (navigation theme, status bar) and the native tabs all follow. `global.css` doesn't change.
- Storage: `expo-secure-store` (already installed, used for Clerk's token cache), key `colorScheme`. It isn't secret, but it's the store the app already has, so no new dependency is needed. It's read synchronously (`SecureStore.getItem`) when the root layout module loads, before the first render, so the saved mode never flashes.
- Web: no button and no override. The browser's `prefers-color-scheme` media query can't be overridden without moving the CSS to a class strategy, and the server-rendered first render must not depend on device state. Split as `color-scheme.ts` / `color-scheme.web.ts`, as `use-theme-color` already is.
- Signing out keeps the choice (it's a device preference, not an account one).

## Out of scope
- A "follow phone" option, or a per-account setting stored on the server.
- Animating the switch (colors change instantly; screen transitions stay native).
- Web support.

## Steps
### 1. Color scheme module
Create `src/theme/color-scheme.ts`:
- `restoreColorScheme()`: reads `SecureStore.getItem("colorScheme")`; if it's `light` or `dark`, calls `Appearance.setColorScheme(value)`. Wrap the read in try/catch (a failed read just follows the phone).
- `useToggleColorScheme()`: returns `{ scheme, toggle }`, where `scheme` comes from `useColorScheme()` (`"light"` when null) and `toggle()` sets the opposite with `Appearance.setColorScheme` and saves it with `SecureStore.setItemAsync` (fire and forget, errors ignored: the switch still applies for this session).
Create `src/theme/color-scheme.web.ts` with a no-op `restoreColorScheme` and a `useToggleColorScheme` returning `null`. Export both from `src/theme/index.ts`. Call `restoreColorScheme()` at module level in `src/app/_layout.tsx`, next to `SplashScreen.preventAutoHideAsync()`.
Done: `tsc` passes.

### 2. Icons and strings
Add `"dark-mode": { ios: "moon", android: "dark_mode" }` and `"light-mode": { ios: "sun.max", android: "light_mode" }` to `src/components/icons.ts`. Add `profile.darkMode` and `profile.lightMode` to en/bg/de:
- en: "Switch to dark mode" / "Switch to light mode"
- bg: "Тъмен режим" / "Светъл режим"
- de: "Dunkelmodus aktivieren" / "Hellmodus aktivieren"

### 3. Button on Profile
In `src/app/(app)/profile/index.tsx`, when `useToggleColorScheme()` isn't null, render `<IconButton variant="outline" icon={dark ? "light-mode" : "dark-mode"} accessibilityLabel={…} onPress={toggle} className="absolute right-0" />` inside the header block, aligned with the top of the avatar (the header `View` gets `relative`). Lint and type check pass.

## Verification
- `npx expo lint` and `npx tsc --noEmit` pass.
- On the phone (user's Samsung, Expo Go): with the phone in dark mode, Profile shows a sun. Tapping it turns the whole app light: screens, cards, text, the tab bar, native headers (e.g. Depots & cars for an owner) and the status bar. The button now shows a moon.
- Kill and reopen the app: it opens light with no dark flash, even though the phone is still dark.
- Tap again → dark, and that survives a restart too.
- Sign out and back in: the choice is kept.
- Bulgarian and German: the screen-reader labels are translated.
- Web: no button, and colors follow the browser.

## AGENTS.md updates
Expo section, replace "Dark mode follows the system." with: "Dark mode follows the system until the user picks one with the moon/sun button on Profile (`useToggleColorScheme` in `src/theme/color-scheme.ts`: `Appearance.setColorScheme`, saved in SecureStore as `colorScheme` and restored before the first render; not on web)."

## Result
Built as planned: `src/theme/color-scheme.ts` (+ `.web.ts` stub), `restoreColorScheme()` in the root layout, `dark-mode`/`light-mode` icons, `profile.darkMode`/`lightMode` strings in en/bg/de, and an outline `IconButton` at the top right of Profile. Lint and type check pass; the on-device checks are left to the user (tested on their Samsung).
