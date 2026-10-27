import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";

const sheet = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
} as const;

// The mechanic's cars: the list, one car (native header with its plate), a vehicle check's photos, the service
// log, a note, and the note and VIN form sheets.
export default function CarsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Titles set by the screens: the plate, the check's day, the note's type. */}
      <Stack.Screen name="car" options={{ title: "", headerBackTitle: t("tabs.cars") }} />
      <Stack.Screen name="check" options={{ title: "" }} />
      <Stack.Screen name="note" options={{ title: "" }} />
      <Stack.Screen name="log" options={{ title: t("carNotes.title") }} />
      <Stack.Screen name="note-form" options={{ ...sheet, sheetAllowedDetents: [0.9] }} />
      <Stack.Screen name="vin" options={sheet} />
    </Stack>
  );
}
