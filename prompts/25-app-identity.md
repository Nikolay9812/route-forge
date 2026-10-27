# 25 · App identity: icon, name, IDs, splash, permissions

Status: done

## Goal
Replace the Expo template placeholders. On the home screen the app shows as "Route Forge" with its own icon on iOS, Android (including adaptive and themed icons) and web. The splash screen uses the brand colours in light and dark mode. The permission prompts describe every real use, in English, Bulgarian and German. The app config has the IDs and settings a later store build needs. No release work.

## Decisions
- App ID `com.routeforge.app` for `ios.bundleIdentifier` and `android.package` (user).
- Icon concept: amber route line (user). A winding route (`primary` #f5b82e, round caps, about 88/1024 px stroke) starts at a filled dot in the upper left and ends at a ringed dot in the lower right, on `ink` #11141c. The mark stays inside the central 66% so the Android adaptive mask never clips it. The colours come from `src/global.css` tokens, and no new tokens are needed.
- Icons are rendered by a local one-off Node script with `pngjs` (already in `node_modules` through Expo, not added as a dependency). The script draws anti-aliased round-capped segments and circles as distance fields, keeps its source in the scratchpad, and only the PNGs are committed. Files:
  - `assets/images/icon.png` 1024: the mark on ink (top-level `icon`, `ios.icon.light`).
  - `assets/images/icon-dark.png` 1024: the amber mark on a transparent background (`ios.icon.dark`, iOS 18+ dark icons).
  - `assets/images/icon-tinted.png` 1024: a white/grey mark on transparent (`ios.icon.tinted`).
  - `assets/images/android-icon-foreground.png` 1024: the mark on transparent, within the safe zone. `android-icon-background.png` is solid ink, and `android-icon-monochrome.png` is a white mark on transparent. `adaptiveIcon.backgroundColor` is `#11141C`.
  - `assets/images/splash-icon.png`: the route in ink with amber end dots, transparent (light splash on `canvas` #f4f5f7). `assets/images/splash-icon-dark.png`: the amber route, transparent (dark splash on dark `canvas` #101216). Each splash matches the app's first screen background, so there's no colour flash. `imageWidth` stays near 76 → 120.
  - `assets/images/favicon.png` 48: from the icon.
- `ios.icon` switches from the template `assets/expo.icon` bundle (Icon Composer, which can't be authored or previewed on Windows) to the documented `{ light, dark, tinted }` PNG object. `assets/expo.icon` is deleted. An Icon Composer `.icon` with Liquid Glass layers can come later, from a Mac.
- Name: `expo.name` becomes "Route Forge" in every language (it's a brand). `slug` stays `route-forge`.
- `description`: "Shifts, hours and pay for courier teams." `web.description` is the same, `web.name`/`shortName` are "Route Forge", `web.themeColor` is #11141C and `web.backgroundColor` is #F4F5F7.
- `primaryColor` #11141C (Android multitasker).
- `ios.config.usesNonExemptEncryption: false` (the app only uses HTTPS).
- Permission prompts (`expo-image-picker` plugin) cover every use. Camera: "Route Forge uses the camera so you can photograph your documents, vehicle checks, the car's registration and service work." Photos: "Route Forge uses your photos so you can add pictures of your documents, your Mentor score and service work." `microphonePermission: false` is set because the app never records video.
- Translated prompts: `locales` in app.json → `src/i18n/native/bg.json` and `src/i18n/native/de.json` with `ios.NSCameraUsageDescription` and `ios.NSPhotoLibraryUsageDescription`, plus `ios.infoPlist.CFBundleAllowMixedLocalizations: true`. English stays in the plugin config. Android permission dialogs are system text, so there's nothing to translate there.
- `android.blockedPermissions`: block what libraries merge in but the app never uses. The list is confirmed from `npx expo config --type introspect` (`modResults` of the manifest). Expected: `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` if present (the picker uses Android's photo picker, which needs none). Keep `INTERNET` and `CAMERA`.

## Out of scope
- Release plumbing: `runtimeVersion`/`updates`, versioning, `eas.json`, store listings, screenshots, privacy policy.
- An Icon Composer `.icon` bundle, and firm logos (those come from firm settings).
- In-app logo usage (onboarding and auth screens keep what they show).

## Steps
### 1. Render the icons
Write the Node script in the scratchpad (pngjs from the project's node_modules), render every PNG listed above, and look at each one (Read the image) at full size and at small scale. Done: all files are replaced, the mark sits inside the adaptive safe zone, and dark/tinted/monochrome have transparent backgrounds.

### 2. App config
Update `app.json` with the name, description, primaryColor, the iOS bundle ID, icon object, encryption flag and CFBundleAllowMixedLocalizations, the Android package, adaptive background colour and blockedPermissions, the web fields, `locales`, the splash plugin (light and dark), and the image-picker strings with microphone off. Delete `assets/expo.icon`. Add the two locale files. Done: `npx expo config` prints the new values, and introspection shows the blocked permissions removed.

## Verification
- `npx expo-doctor`, `npx expo lint`, `npx tsc --noEmit` pass.
- `npx expo config --type public` shows the name, IDs, icons, splash with `dark`, and locales. `npx expo config --type introspect` shows the iOS Info.plist strings and the Android manifest without the blocked permissions.
- Every PNG is viewed. The icon is legible at 48 px (the favicon).
- On the user's phone in Expo Go, the splash and icon still come from Expo Go, so the real icon, name and splash show only in a development or store build. That can't be checked now and is reported as ❌.

## AGENTS.md updates
- Expo section: app identity. The ID is `com.routeforge.app` (fixed once released). Icons are PNGs in `assets/images/` (amber route on ink; iOS light/dark/tinted, Android adaptive + monochrome), and the splash is light/dark on `canvas`. Native permission prompts live in the image-picker plugin (EN) and `src/i18n/native/{bg,de}.json`. Update them whenever a new photo or camera use is added. Block unused Android permissions in `android.blockedPermissions`.

## Result
Built as planned except for two changes found while building. (1) `expo-image-picker` requests READ/WRITE_EXTERNAL_STORAGE on Android 12 and older (camera on 9 and older), so those stay. Only `SYSTEM_ALERT_WINDOW` is blocked, and RECORD_AUDIO is removed by `microphonePermission: false`. (2) `expo-secure-store` gets `faceIDPermission: false` because the app never uses biometrics, which drops the generic Face ID prompt. The icons are rendered by a scratchpad script (not committed), `assets/expo.icon` is deleted, and splash `imageWidth` is 120. Introspection confirms the iOS Info.plist strings and Android manifest. The real icon, name and splash only show in a native build, not in Expo Go.
