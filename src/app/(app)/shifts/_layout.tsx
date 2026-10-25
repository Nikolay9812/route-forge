import { Stack } from "expo-router";

import { TodayShiftProvider } from "@/shifts/today-shift";

// Today's shift form and its finish sheet share one loaded, autosaving shift.
export default function ShiftsLayout() {
  return (
    <TodayShiftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="finish"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
          }}
        />
      </Stack>
    </TodayShiftProvider>
  );
}
