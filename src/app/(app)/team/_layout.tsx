import { Stack } from "expo-router";

import { ApprovalsProvider } from "@/approvals/approvals";
import { useTranslation } from "@/i18n";

// The couriers a reviewer may see, one courier's calendar (native header with their name), and the same review
// detail and reject sheet as the Approvals stack, so Back returns to the calendar.
export default function TeamLayout() {
  const { t } = useTranslation();
  return (
    <ApprovalsProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="[userId]" options={{ title: "", headerBackTitle: t("team.title") }} />
        <Stack.Screen name="shift/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="shift/reject"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
          }}
        />
      </Stack>
    </ApprovalsProvider>
  );
}
