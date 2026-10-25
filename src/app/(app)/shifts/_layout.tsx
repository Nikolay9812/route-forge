import { Stack } from "expo-router";

import { ShiftDraftProvider } from "@/shifts/shift-draft-context";

// Today's shift form and its finish sheet share the in-memory draft.
export default function ShiftsLayout() {
  return (
    <ShiftDraftProvider>
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
    </ShiftDraftProvider>
  );
}
