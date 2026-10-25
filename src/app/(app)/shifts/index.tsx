import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useSyncExternalStore } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { RecentShifts } from "@/components/home/recent-shifts";
import { SectionEntrance } from "@/components/home/section-entrance";
import { PackagesCard } from "@/components/shifts/packages-card";
import { RouteCard } from "@/components/shifts/route-card";
import { StartCard } from "@/components/shifts/start-card";
import { SubmittedCard } from "@/components/shifts/submitted-card";
import { TimeCard } from "@/components/shifts/time-card";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { todayIn } from "@/domain/dates";
import { sampleFirm, sampleMonth } from "@/home/sample";
import { useTranslation } from "@/i18n";
import { canFinish } from "@/shifts/draft";
import { sampleBuses, sampleStations } from "@/shifts/sample";
import { useShiftDraft } from "@/shifts/shift-draft-context";

const noSubscription = () => () => {};

// Today's shift: pick station and bus, start, fill in km and packages, then finish in a sheet.
// Sample data until the shifts API exists. In development, `?sample=offline` makes submitting fail.
export default function Shifts() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  const { draft, set, start, setStartTime, reset } = useShiftDraft();
  const firm = sampleFirm;
  const format = useFormat(firm.timeZone, firm.currency);

  // null on the server, so web hydration matches; the device reads today's date in the firm's timezone.
  const date = useSyncExternalStore(
    noSubscription,
    () => todayIn(firm.timeZone),
    () => null,
  );
  const today = useMemo(() => (date ? { date, recent: sampleMonth(date).past.slice(0, 5) } : null), [date]);

  const openFinish = () =>
    router.push({ pathname: "/shifts/finish", params: __DEV__ && sample === "offline" ? { sample } : {} });

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
      <SectionEntrance index={0}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <ThemedText variant="heading" accessibilityRole="header">
              {t("shifts.title")}
            </ThemedText>
            {today ? <ThemedText variant="footnote">{format.longDay(today.date)}</ThemedText> : null}
          </View>
          <Tag tone="highlight" size="sm" label={t("home.sampleData")} />
        </View>
      </SectionEntrance>

      {/* Keyed by phase so each phase fades in once when it arrives. */}
      <SectionEntrance key={draft.phase} index={1}>
        {draft.phase === "notStarted" ? (
          <StartCard draft={draft} stations={sampleStations} buses={sampleBuses} onChange={set} onStart={start} />
        ) : draft.phase === "inProgress" && draft.startedAt !== null ? (
          <View className="gap-4">
            <TimeCard
              startedAt={draft.startedAt}
              timeZone={firm.timeZone}
              format={format}
              onChangeStart={setStartTime}
            />
            <RouteCard draft={draft} stations={sampleStations} buses={sampleBuses} format={format} onChange={set} />
            <PackagesCard draft={draft} format={format} onChange={set} />
            <Button title={t("shifts.finish.button")} disabled={!canFinish(draft)} onPress={openFinish} />
          </View>
        ) : (
          <SubmittedCard draft={draft} format={format} onReset={__DEV__ ? reset : undefined} />
        )}
      </SectionEntrance>

      {today && today.recent.length > 0 ? (
        <SectionEntrance index={2}>
          <RecentShifts shifts={today.recent} format={format} onSeeAll={() => {}} onPressShift={() => {}} />
        </SectionEntrance>
      ) : null}
    </ScrollView>
  );
}
