import { View } from "react-native";

import type { CalendarState } from "@/calendar/use-calendar";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { Notice } from "@/components/notice";
import type { CalendarMonth, Shift } from "@/domain/types";
import { useTranslation } from "@/i18n";

import { CalendarCard } from "./calendar-card";
import { StatusLine } from "./status-line";

// The status line and calendar card with their first-load states: grey blocks while loading, or the error with
// Retry. Once a month has loaded, later failures show inside the card and the rest stays on screen.
export function CalendarSection({
  state,
  onOpenShift,
}: {
  state: CalendarState<CalendarMonth>;
  onOpenShift: (shift: Shift) => void;
}) {
  const { t } = useTranslation();
  const firm = state.latest?.firm;
  const format = useFormat(firm?.timeZone ?? "UTC", firm?.currency ?? "EUR");

  if (!state.latest) {
    if (!state.failure) {
      return (
        <View className="gap-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-14 rounded-lg bg-border" />
          <View className="h-120 rounded-lg bg-border" />
        </View>
      );
    }
    if (state.failure === "role" || state.failure === "firmNotSetUp") {
      return state.failure === "role" ? (
        <Notice icon="profile" title={t("firm.roleNotYet.title")} body={t("firm.roleNotYet.body")} />
      ) : (
        <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
      );
    }
    return (
      <View className="gap-3">
        <Alert
          tone={state.failure === "offline" ? "offline" : "danger"}
          message={state.failure === "offline" ? t("calendar.offline") : t("calendar.error")}
        />
        <Button title={t("home.retry")} variant="secondary" onPress={state.retry} />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <StatusLine stats={state.data?.stats} />
      <CalendarCard state={state} format={format} onOpenShift={onOpenShift} />
    </View>
  );
}
