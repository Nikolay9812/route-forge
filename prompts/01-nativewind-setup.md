# 01 · NativeWind v5 setup

Status: done

## Goal
Screens can be styled with Tailwind `className` props on React Native components (iOS, Android, web), using NativeWind v5 and Tailwind CSS v4, set up as described in https://www.nativewind.dev/v5/llms-full.txt.

## Decisions
- NativeWind v5 is still a release candidate. Pin the exact versions from the docs: `nativewind@5.0.0-rc.0`, `react-native-css@3.1.0-rc.0`, `tailwindcss@4.1.12`, `@tailwindcss/postcss@4.1.12`, `lightningcss@1.30.1` (also forced with an npm `overrides` entry), plus `postcss`.
- The docs were tested on Expo SDK 57. This app is on SDK 58 (RN 0.88, React 19.3). The RC's peer dependencies accept these versions, but SDK 58 itself is untested upstream. If bundling fails because of it, stop and report instead of working around it.
- Reanimated, Worklets, safe-area-context, and expo-system-ui are already installed, so they aren't installed again.
- The stylesheet lives at `src/global.css` (outside `src/app/`, per AGENTS.md) and is imported once in `src/app/_layout.tsx`.
- Use the docs' layered `global.css` (theme, preflight, and utilities imported separately) so React Native Web defaults don't override utilities.
- No Babel config. v5 doesn't need the v4 preset or `jsxImportSource`.
- Add `nativewind-env.d.ts` at the repo root for `className` types. It's covered by the existing tsconfig `**/*.ts` include.
- Dark mode: `userInterfaceStyle: "automatic"` is already set in `app.json`.
- Install with `npx expo install <pkg>@<version> -- --save-exact` (`--save-dev` for dev tools), following AGENTS.md.

## Out of scope
- Design tokens and the design system (colors, type, and spacing from the designs). These come in a later plan.
- Restyling real screens. Only the placeholder `src/app/index.tsx` changes, as a smoke test.

## Steps
### 1. Install packages
Run `npx expo install nativewind@5.0.0-rc.0 react-native-css@3.1.0-rc.0 -- --save-exact` and `npx expo install tailwindcss@4.1.12 @tailwindcss/postcss@4.1.12 postcss lightningcss@1.30.1 -- --save-dev --save-exact`. Add `"overrides": { "lightningcss": "1.30.1" }` to `package.json` and reinstall. Done when `npm ls lightningcss` shows only 1.30.1.

### 2. Config files
- `postcss.config.mjs` (must be `.mjs` or `.js`, not `.cjs`): `export default { plugins: { "@tailwindcss/postcss": {} } };`
- `metro.config.js`: `getDefaultConfig(__dirname)` from `expo/metro-config`, wrapped in `withNativewind` from `nativewind/metro`.
- `src/global.css`:
  ```css
  @import "tailwindcss/theme.css" layer(theme);
  @import "tailwindcss/preflight.css" layer(base);
  @import "tailwindcss/utilities.css";

  @import "nativewind/theme";
  ```
- `nativewind-env.d.ts`: `/// <reference types="react-native-css/types" />`

### 3. Wire up and smoke-test
Add `import "@/global.css";` at the top of `src/app/_layout.tsx`. Replace the `StyleSheet` in `src/app/index.tsx` with `className="flex-1 items-center justify-center bg-white"` on the `View` and `className="text-xl font-bold text-blue-500"` on the `Text`. Keep the existing placeholder copy.

## Verification
- `npx tsc --noEmit` and `npx expo lint` pass.
- `npx expo-doctor` reports no new problems. Warnings about the pinned RC versions are expected and should be listed.
- `npx expo export --platform ios` and `--platform web` bundle without CSS deserialization errors.
- On a device or simulator: `npx expo start --clear` shows the text centered, bold, blue, and larger. The iOS simulator check needs a Mac. This machine runs Windows, so the user does it with Expo Go, or with web via `npx expo start --web`.

## AGENTS.md updates
- Expo section: "Styling uses NativeWind v5 (pinned RC) with Tailwind v4: `className` on RN components; `src/global.css` is the only stylesheet, imported in the root layout. Use `StyleSheet` only for what a utility can't express. Keep NativeWind, react-native-css, tailwindcss, and lightningcss pinned. Upgrade them together."

## Result
Built as planned on SDK 58 with no workarounds. Type check, lint, and expo-doctor pass. The iOS and web exports compile the utilities (web CSS contains `.text-blue-500`, `.flex-1`, and so on). Deviations: `expo install` placed the Tailwind tooling in `dependencies`, so it was moved to `devDependencies`. NativeWind added `nativewind-env.d.ts` to the tsconfig `include`. The first `npx expo lint` run set up ESLint (`eslint`, `eslint-config-expo`, `eslint.config.js`). Nothing was checked on a real device or simulator yet.
