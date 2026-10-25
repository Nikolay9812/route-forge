import { router } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ApiFailure } from "@/api/client";
import { useCalendar } from "@/calendar/use-calendar";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { PackagesCard } from "@/components/shifts/packages-card";
import { RejectionAlert } from "@/components/shifts/rejection-alert";
import { RouteCard } from "@/components/shifts/route-card";
import { SaveStatus } from "@/components/shifts/save-status";
import { ShiftsSkeleton } from "@/components/shifts/shifts-skeleton";
import { StartCard } from "@/components/shifts/start-card";
import { SubmittedCard } from "@/components/shifts/submitted-card";
import { TimeCard } from "@/components/shifts/time-card";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation, type TranslationKey } from "@/i18n";
import { canFinish } from "@/shifts/draft";
import { useTodayShift } from "@/shifts/today-shift";

// Formats nothing visible: only used until the firm's own settings have loaded.
const beforeLoad = { timeZone: "UTC", currency: "EUR" };

function startMessage(failure: ApiFailure): TranslationKey | null {
  if (failure === "exists") return null; // Started elsewhere: the screen reloads with that shift.
  return failure === "offline" ? "shifts.start.offline" : "shifts.start.error";
}

// Today's shift: pick station and bus, start, fill in km and packages (autosaved), then finish in a sheet.
// Below it, the month calendar of the courier's shifts.
export default function Shifts() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { load, shift, phase, fields, save, set, start, setStartTime, retrySave, reload } = useTodayShift();
  const firm = load.status === "ready" ? load.firm : beforeLoad;
  const format = useFormat(firm.timeZone, firm.currency);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<TranslationKey | null>(null);
  // Today's mark follows the shift: starting or submitting it reloads the shown month.
  const calendar = useCalendar("/api/calendar", `${shift?.id}:${shift?.status}`);

  const onStart = async () => {
    setStarting(true);
    setStartError(null);
    const failure = await start();
    setStarting(false);
    if (failure) setStartError(startMessage(failure));
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {load.status === "loading" ? (
        <ShiftsSkeleton />
      ) : load.status !== "ready" ? (
        <SectionEntrance index={0}>
          <View className="gap-3">
            <ThemedText variant="heading" accessibilityRole="header">
              {t("shifts.title")}
            </ThemedText>
            {load.status === "role" ? (
              <Notice icon="profile" title={t("firm.roleNotYet.title")} body={t("firm.roleNotYet.body")} />
            ) : load.status === "firmNotSetUp" ? (
              <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
            ) : (
              <>
                <Alert
                  tone={load.status === "offline" ? "offline" : "danger"}
                  message={load.status === "offline" ? t("shifts.offline") : t("shifts.error")}
                />
                <Button title={t("home.retry")} variant="secondary" onPress={reload} />
              </>
            )}
          </View>
        </SectionEntrance>
      ) : (
        <>
          <SectionEntrance index={0}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <ThemedText variant="heading" accessibilityRole="header">
                  {t("shifts.title")}
                </ThemedText>
                <ThemedText variant="footnote">{format.longDay(load.date)}</ThemedText>
              </View>
              <Tag tone="role" size="sm" label={load.firm.name} />
            </View>
          </SectionEntrance>

          {/* Keyed by phase so each phase fades in once when it arrives. */}
          <SectionEntrance key={phase} index={1}>
            {phase === "notStarted" ? (
              <View className="gap-3">
                <StartCard
                  fields={fields}
                  stations={load.stations}
                  buses={load.buses}
                  starting={starting}
                  onChange={set}
                  onStart={() => void onStart()}
                />
                {startError ? <Alert tone="danger" message={t(startError)} /> : null}
              </View>
            ) : phase === "inProgress" && shift ? (
              <View className="gap-4">
                <RejectionAlert rejection={shift.rejection} />
                <TimeCard
                  startedAt={Date.parse(shift.startedAt)}
                  timeZone={firm.timeZone}
                  format={format}
                  onChangeStart={setStartTime}
                />
                <RouteCard
                  fields={fields}
                  stations={load.stations}
                  buses={load.buses}
                  format={format}
                  onChange={set}
                />
                <PackagesCard fields={fields} format={format} onChange={set} />
                <SaveStatus state={save} onRetry={() => void retrySave()} />
                <Button
                  title={t("shifts.finish.button")}
                  disabled={!canFinish(fields)}
                  onPress={() => router.push("/shifts/finish")}
                />
              </View>
            ) : shift ? (
              <SubmittedCard shift={shift} format={format} />
            ) : null}
          </SectionEntrance>

          <SectionEntrance index={2}>
            <CalendarSection
              state={calendar}
              onOpenShift={(s) => router.push({ pathname: "/shifts/[id]", params: { id: s.id } })}
            />
          </SectionEntrance>
        </>
      )}
    </ScrollView>
  );
}
