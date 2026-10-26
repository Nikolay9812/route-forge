import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";
import { TodayShiftProvider } from "@/shifts/today-shift";

// Today's shift form and its finish sheet share one loaded, autosaving shift. [id] is any one of the courier's
// shifts (read-only, or fixable when rejected), with a native header. The vin sheet shows a car's VIN as a QR code.
const sheet = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
} as const;

export default function ShiftsLayout() {
  const { t } = useTranslation();
  return (
    <TodayShiftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" options={{ headerShown: true, title: "", headerBackTitle: t("tabs.shifts") }} />
        <Stack.Screen name="finish" options={sheet} />
        <Stack.Screen name="vin" options={sheet} />
      </Stack>
    </TodayShiftProvider>
  );
}
