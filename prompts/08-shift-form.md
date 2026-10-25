# 08 · Shift form (UI only, sample data)

Status: done

## Goal
A courier opens the Shifts tab (or taps Continue shift on Home) and logs today's shift. They pick a station and a bus, enter the start km and loaded packages, then tap Start shift. During the shift they fill in end km, delivered, returned and Abholung, and can edit everything until they tap Finish shift. Finish shows a summary sheet, and confirming submits the shift and locks the fields. Everything runs on in-memory sample data; nothing is saved to the server.

## Decisions
- The Shifts tab opens straight on today's shift form. Recent shifts sit in a short list below it, reusing Home's `RecentShifts`.
- The shift has three phases: **not started → in progress → submitted**. (The API plan maps them to `draft` and `submitted`.)
- Working time comes from Start / Finish buttons that record the times. The start time can be fixed by hand, typed as `HH:MM` in a text field. A native time picker needs a new dependency, so it is left out for now.
- Before Start, the form shows only station, bus, start km and loaded packages. After Start it also shows end km, delivered, returned and Abholung.
- Packages: the courier types all four numbers. If delivered + returned ≠ loaded, a non-blocking warning appears on the form and on the summary sheet.
- Station and bus are picked from chips in a row, using `Chip` with `tone="primary"` (depot filters are primary on Board 06) and the `depot` / `car` icons. They stay editable until Finish. A "use as my default" setting comes later.
- Numbers are typed in `TextField`s with `keyboardType="number-pad"`, which accept digits only. Tapping outside the field or dragging the scroll view closes the keyboard.
- Finish shift opens an Expo Router `formSheet` with the summary and two buttons: Submit shift (primary) and Keep editing (secondary). Submitting locks the form.
- Km driven = end km − start km, shown live. If end km < start km, the field shows an error and Finish is disabled.
- Finish is enabled only when end km and delivered are filled in and end km ≥ start km.
- The design is built from the Design Board with existing tokens and components, since no mockup was attached. No new tokens are needed. The mismatch warning reuses `Alert tone="danger"` because there is no warning tone yet.
- Sample stations: `HBW3`, `HBW1`, `HBW7`. Sample buses: `KH I 6004`, `KH I 5120`, `KH I 7732`. Nothing is preselected. These stand in for database data, so they aren't translated.
- Labels: EN "Pickups", DE "Abholung", BG "Взети пратки". Each package field has a one-line helper under the section title explaining the four numbers.
- A "Sample data" tag sits in the header, as on Home. A dev-only "Reset sample shift" button appears under the submitted card so the flow can be tested again.
- In dev, `?sample=offline` makes Submit fail with the offline alert inside the sheet, and everything typed stays on screen.
- The state lives in a React context in the Shifts stack layout, so it survives tab switches. It resets on app reload.

## Out of scope
- API routes, database tables, saving the shift. That is the shifts API plan, which replaces `src/shifts/sample.ts` and the in-memory store.
- Default station or bus per courier, dispatcher approval, rejected-shift editing, shift detail screens, the full shift history list.
- A native time picker (needs a dependency).
- Home's Today card reading the live form state. Home keeps its own sample.

## Screen design

All spacing uses the 4px step, and all colors, type and radii are existing tokens. The screen is a `ScrollView` on `bg-canvas` with `px-4 pb-8 gap-6`, and its insets are handled the same way as Home (`contentInsetAdjustmentBehavior="automatic"` on iOS, `insets.top + 8` on Android). `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, `automaticallyAdjustKeyboardInsets`.

**Header** (row, `justify-between`): title "Today's shift" (`heading`), weekday and date below it (`footnote`, ink-muted), and the `Tag tone="highlight" size="sm"` "Sample data" on the right.

**Phase 1: not started.** One `Surface` with `p-5 gap-5`:
- Top row: label "Before you start" (`label`) and `Tag tone="draft" size="sm"` "Not started".
- "Station" (`label`), then a wrapping row of chips (`flex-row flex-wrap gap-2`) with the depot icon.
- "Bus" (`label`), then the plate chips with the car icon.
- Two labeled fields side by side (`flex-row gap-3`, each `flex-1`): "Start km" (km icon) and "Loaded" (packages icon).
- `Button` "Start shift". It is disabled until station, bus, start km and loaded are set.

**Phase 2: in progress.** Three cards with `gap-4` between them:
1. **Time card** (`Surface p-5 gap-3`): top row "Working time" (`label`) and `Tag tone="draft" size="sm"` "In progress". The elapsed time `H:MM` is shown in `number` variant with a live tick every minute. Below it is a row with the clock icon and "Started at 07:30" (`footnote`), plus an "Edit" `Button size="sm" variant="secondary"`. Edit swaps the row for an `HH:MM` text field with Save and Cancel. A time in the future or an invalid one shows a field error.
2. **Route card** (`Surface p-5 gap-4`): "Route" (`title`). The station chips and bus chips stay editable. The fields "Start km" and "End km" sit side by side. Below them is a `footnote` "Driven: 87 km", or a field error on End km: "Must be at least the start km".
3. **Packages card** (`Surface p-5 gap-4`): "Packages" (`title`) with a `footnote` helper: "Loaded is what you took. Returned is what you bring back undelivered. Pickups are customer returns you collected." Below that is a 2×2 grid of labeled number fields: Loaded / Delivered, Returned / Pickups. When delivered + returned ≠ loaded, an `Alert tone="danger"` reads: "Delivered + returned is 138, but you loaded 140."
- At the bottom: `Button` "Finish shift" (primary).

**Finish sheet** (`formSheet`, fitting content, grabber visible, `bg-surface`, `p-6 gap-5`):
- "Finish shift?" (`heading`) and "After you submit, the dispatcher reviews it and you can't edit it." (`body`, ink-muted).
- Summary rows in a grouped list (rows divided by `Divider`, label on the left in `body` ink-muted and value on the right in `label`): Working time `07:30 – 16:12 · 8:42 h`, Station, Bus, Km `48 213 → 48 300 · 87 km`, Loaded, Delivered, Returned, Pickups.
- The mismatch `Alert`, if there is one. The offline `Alert` appears if submitting failed.
- `Button` "Submit shift" (with loading state on a short fake delay) and `Button variant="secondary"` "Keep editing".

**Phase 3: submitted.** The sheet closes and the form is replaced by one `Surface p-5 gap-4`:
- "Today" (`label`) and `Tag tone="submitted" size="sm"` "Submitted".
- Three metrics as on Home's Today card: hours, packages delivered, km.
- The car and station row, as on the Today card.
- A `footnote` "Waiting for dispatcher approval."
- Dev only: `Button variant="destructive"` "Reset sample shift".

**Below all phases:** "Recent shifts" via `RecentShifts` with Home's sample month (the "see all" link and row taps do nothing for now).

**Motion:** sections use `SectionEntrance` (from Home) on first arrival only. Switching phases fades the new card in, using the same rules and reduced motion. No layout animations.

## Steps

### 1. Sample data and in-memory store
- `src/shifts/sample.ts`: `sampleStations`, `sampleBuses`, plus a header comment saying it is deleted by the shifts API plan.
- `src/shifts/draft.ts`: pure helpers covering `kmDriven`, `packageMismatch` (returns `{ accounted, loaded } | null`), `canStart`, `canFinish`, `parseClock("HH:MM")` and `elapsedMinutes`.
- `src/shifts/shift-draft-context.tsx`: `ShiftDraftProvider` plus `useShiftDraft()`, built on `useReducer`. It holds phase, station, bus, startedAt, finishedAt, the km fields and the package fields, kept as strings for the inputs. Actions: `set`, `start`, `setStartTime`, `submit` (async, with fake delay; throws offline when `?sample=offline` in dev), `reset`.
- Done when: `npx tsc --noEmit` passes.

### 2. Route structure
- Move `src/app/(app)/shifts.tsx` to `src/app/(app)/shifts/index.tsx`. Add `shifts/_layout.tsx` (a `Stack` with `headerShown: false`, wrapped in `ShiftDraftProvider`) and `shifts/finish.tsx` with `presentation: "formSheet"`, `sheetAllowedDetents: "fitToContents"` and `sheetGrabberVisible: true`. Before writing, check these options against the Expo Router docs for SDK 58.
- The tab trigger name `shifts` keeps working. Home's `router.navigate("/shifts")` still lands on the form.
- Done when: the tab opens and `router.push("/shifts/finish")` shows a sheet on Android and iOS.

### 3. Components
In `src/components/shifts/`:
- `number-field.tsx`: wraps `TextField` with a label, `number-pad` keyboard and digits-only filtering.
- `choice-chips.tsx`: a label plus a wrapping row of `Chip`s.
- `start-card.tsx`, `time-card.tsx`, `route-card.tsx`, `packages-card.tsx`, `submitted-card.tsx`.
- `shift-summary.tsx`: the grouped rows used by the sheet.
- Add `time` formatting (`HH:MM` in the firm's timezone) to `src/components/home/format.ts` if it isn't already there. Reuse `clock()` for durations.
- Done when: lint and the type check pass.

### 4. Screens
- `shifts/index.tsx`: header, the phase switch, then recent shifts.
- `shifts/finish.tsx`: summary, the alerts, submit and keep editing. On success it calls `router.back()`.
- Remove `TabPlaceholder` usage for Shifts and drop the `placeholder.shifts.*` keys. If nothing else uses the component, delete it as well.
- Done when: the whole flow works on the phone.

### 5. Translations
- Add a `shifts.*` section to `en.json`, `bg.json` and `de.json` with every string above. Use `units.*` and `status.*` where they already exist.

## Verification
- `npx expo lint` and `npx tsc --noEmit` pass.
- On the phone (the user reloads Metro with `--clear`):
  1. Shifts tab: Start shift stays disabled until station, bus, start km and loaded are all set.
  2. Tap Start: the timer shows `0:00` and "Started at" shows the current time. Edit the start time to one hour earlier and the timer shows `1:00`. A future time is rejected with a field error.
  3. Type end km lower than start km: the field shows an error and Finish is disabled. Fix it, and "Driven" updates live.
  4. Loaded 140, delivered 130, returned 8: the warning appears. Set returned to 10 and the warning disappears.
  5. Switch to Home and back: everything typed is still there.
  6. Tap Finish shift: the sheet shows the correct summary. Keep editing closes it and leaves the fields editable. Finish, then Submit: the card changes to Submitted and the fields are gone.
  7. Reset sample shift returns to phase 1.
  8. With `?sample=offline`, Submit shows the offline alert in the sheet. Close it and every value is still there.
  9. Switch the device language to BG and DE: every label is translated and Manrope is used for BG. Dark mode is readable.
- Screenshots: the user tests on their Samsung, so a simulator comparison isn't possible. The user sends screenshots and I list the differences.

## AGENTS.md updates
- Under "Who owns what", next to Home data: the shift form state comes from `useShiftDraft()` in `src/shifts/` (in-memory sample until the shifts API exists, which replaces it and deletes `src/shifts/sample.ts`).
- Under Domain → Shift: a shift records start km, end km, loaded, delivered, returned and pickups (Abholung). Km driven is end − start. Working time comes from start and finish times.

## Result
Built as planned. The Shifts tab became a stack (`shifts/index.tsx` and the `shifts/finish.tsx` form sheet) around an in-memory `ShiftDraftProvider`. The components are in `src/components/shifts/`, the helpers in `src/shifts/draft.ts`, and `minuteOfDayIn` was added to `src/domain/dates.ts`. Lint and the type check pass. The on-phone checks are left to the user (Samsung, Expo Go).

After the first review on the phone:
- Delivered is no longer a field. It is calculated as loaded − returned, and the mismatch warning is gone. Returned above loaded is a field error that blocks Finish.
- Station and bus chips sit in one row that scrolls sideways.
- The card gaps are now `gap-4`. The first-time `gap-5` class didn't apply in the running bundle.
