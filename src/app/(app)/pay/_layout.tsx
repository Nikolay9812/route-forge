import { Stack } from "expo-router";

import { PayMonthProvider } from "@/pay/pay-month";

// The month and its breakdown sheet share one loaded, paged pay state. The sheet opens at half height and drags
// to full; the table scrolls inside it.
export default function PayLayout() {
  return (
    <PayMonthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="breakdown"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
          }}
        />
      </Stack>
    </PayMonthProvider>
  );
}
