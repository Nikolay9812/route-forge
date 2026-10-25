import { Stack } from "expo-router";

import { FleetProvider } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";

const sheet = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
} as const;

// Profile, and for owners the firm's depots and cars (native header) with their add/edit sheets.
export default function ProfileLayout() {
  const { t } = useTranslation();
  return (
    <FleetProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="fleet" options={{ title: t("fleet.title"), headerBackTitle: t("tabs.profile") }} />
        <Stack.Screen name="depot" options={sheet} />
        <Stack.Screen name="car" options={sheet} />
      </Stack>
    </FleetProvider>
  );
}
