import { Stack } from "expo-router";

import { FleetProvider } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";
import { PayRatesProvider } from "@/pay-rates/pay-rates";

const sheet = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
} as const;

// Profile, and for owners the firm's depots and cars and its pay rates (native headers) with their form sheets.
export default function ProfileLayout() {
  const { t } = useTranslation();
  return (
    <FleetProvider>
      <PayRatesProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="fleet" options={{ title: t("fleet.title"), headerBackTitle: t("tabs.profile") }} />
          <Stack.Screen name="depot" options={sheet} />
          <Stack.Screen name="car" options={sheet} />
          <Stack.Screen name="pay-rates" options={{ title: t("payRates.title"), headerBackTitle: t("tabs.profile") }} />
          {/* The title is the courier's name or "Firm default", set by the screen. */}
          <Stack.Screen name="pay-rate" options={{ title: "", headerBackTitle: t("payRates.title") }} />
          <Stack.Screen name="rate-change" options={sheet} />
        </Stack>
      </PayRatesProvider>
    </FleetProvider>
  );
}
