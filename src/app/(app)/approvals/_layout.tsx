import { Stack } from "expo-router";

import { ApprovalsProvider } from "@/approvals/approvals";
import { useTranslation } from "@/i18n";

// The approvals queue, one shift's detail (native header with the courier's name), and the reject sheet.
export default function ApprovalsLayout() {
  const { t } = useTranslation();
  return (
    <ApprovalsProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="[id]" options={{ title: "", headerBackTitle: t("tabs.approvals") }} />
        <Stack.Screen
          name="reject"
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
