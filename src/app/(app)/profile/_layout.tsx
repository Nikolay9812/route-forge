import { Stack } from "expo-router";

import { DocumentsProvider } from "@/documents/documents";
import { FleetProvider } from "@/fleet/fleet";
import { useTranslation } from "@/i18n";
import { PayRatesProvider } from "@/pay-rates/pay-rates";
import { PeopleProvider } from "@/people/people";

const sheet = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
} as const;

// Profile with the courier's documents, and for owners the firm's depots and cars (each car with its papers), its
// pay rates, its people and its couriers' documents (native headers), with their form sheets.
export default function ProfileLayout() {
  const { t } = useTranslation();
  return (
    <FleetProvider>
      <PayRatesProvider>
        <DocumentsProvider>
          <PeopleProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="fleet" options={{ title: t("fleet.title"), headerBackTitle: t("tabs.profile") }} />
              {/* The title is the car's plate, set by the screen. */}
              <Stack.Screen name="vehicle" options={{ title: "", headerBackTitle: t("fleet.title") }} />
              <Stack.Screen name="depot" options={sheet} />
              <Stack.Screen name="car" options={sheet} />
              <Stack.Screen name="pay-rates" options={{ title: t("payRates.title"), headerBackTitle: t("tabs.profile") }} />
              {/* The title is the courier's name or "Firm default", set by the screen. */}
              <Stack.Screen name="pay-rate" options={{ title: "", headerBackTitle: t("payRates.title") }} />
              <Stack.Screen name="rate-change" options={sheet} />
              <Stack.Screen name="couriers" options={{ title: t("documents.couriers"), headerBackTitle: t("tabs.profile") }} />
              {/* Titles set by the screens: the courier's name, and the section. */}
              <Stack.Screen name="courier" options={{ title: "", headerBackTitle: t("documents.couriers") }} />
              <Stack.Screen name="document" options={{ title: "" }} />
              <Stack.Screen name="people" options={{ title: t("people.title"), headerBackTitle: t("tabs.profile") }} />
              {/* The title is the person's name, set by the screen. */}
              <Stack.Screen name="person" options={{ title: "", headerBackTitle: t("people.title") }} />
              <Stack.Screen name="invite" options={sheet} />
            </Stack>
          </PeopleProvider>
        </DocumentsProvider>
      </PayRatesProvider>
    </FleetProvider>
  );
}
