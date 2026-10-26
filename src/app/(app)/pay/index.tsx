import { router } from "expo-router";
import { useRef } from "react";
import { Platform, RefreshControl, ScrollView, View, type ScrollViewInstance } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chevron, Swipe } from "@/components/calendar/calendar-card";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import {
  MonthSummary,
  type BreakdownKind,
} from "@/components/pay/month-summary";
import { RecentMonths } from "@/components/pay/recent-months";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { usePayMonth } from "@/pay/pay-month";
import { useThemeColor } from "@/theme";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Opacity only, so reduced motion needs nothing different.
const monthFade = FadeIn.duration(180).easing(EASE_OUT);

// Formats nothing visible: only used until the firm's own settings have loaded.
const beforeLoad = { timeZone: "UTC", currency: "EUR" };

function MonthSkeleton() {
  return (
    <View
      className="gap-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="h-48 rounded-lg bg-border" />
      <View className="flex-row gap-3">
        <View className="h-28 flex-1 rounded-lg bg-border" />
        <View className="h-28 flex-1 rounded-lg bg-border" />
        <View className="h-28 flex-1 rounded-lg bg-border" />
      </View>
    </View>
  );
}

// The courier's pay, one month at a time: estimated pay from approved shifts and the month's hours, packages and
// km. Chevrons and a horizontal swipe page months; the card and tiles open a day-by-day breakdown. Below, the 5
// months before this one; a row shows that month above.
export default function Pay() {
  const { t } = useTranslation();
  const state = usePayMonth();
  const { month, data, latest, failure } = state;
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const spinner = useThemeColor("secondary-ink");
  const format = useFormat(
    latest?.firm.timeZone ?? beforeLoad.timeZone,
    latest?.firm.currency ?? beforeLoad.currency,
  );

  const open = (kind: BreakdownKind) =>
    router.push({ pathname: "/pay/breakdown", params: { kind } });
  const showMonth = (target: string) => {
    state.goTo(target);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const failed = (
    <View className="gap-3">
      <Alert
        tone={failure === "offline" ? "offline" : "danger"}
        message={t(failure === "offline" ? "pay.offline" : "pay.error")}
      />
      <Button
        title={t("home.retry")}
        variant="secondary"
        onPress={state.retry}
      />
    </View>
  );

  return (
    <ScrollView
      ref={scroll}
      className="flex-1 bg-canvas"
      // iOS insets the content for the status bar and the tab bar itself; Android's tab bar sits below the screen.
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{
        paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8,
      }}
      refreshControl={
        data ? (
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            tintColor={spinner}
            colors={[spinner]}
          />
        ) : undefined
      }
    >
      {!month || !latest ? (
        failure === "role" ? (
          <Notice
            icon="profile"
            title={t("firm.roleNotYet.title")}
            body={t("firm.roleNotYet.body")}
          />
        ) : failure ? (
          failed
        ) : (
          <View className="gap-6">
            <View className="h-8 w-40 rounded-sm bg-border" />
            <MonthSkeleton />
          </View>
        )
      ) : (
        <View className="gap-6">
          <SectionEntrance index={0}>
            <Swipe
              onPrev={state.canPrev ? state.prev : undefined}
              onNext={state.canNext ? state.next : undefined}
            >
              <View className="gap-4">
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 gap-1">
                    <ThemedText
                      variant="title"
                      accessibilityRole="header"
                      numberOfLines={1}
                    >
                      {format.calendarMonth(`${month}-01`, latest.today)}
                    </ThemedText>
                    <ThemedText variant="footnote">
                      {t("pay.month.approvedOnly")}
                    </ThemedText>
                  </View>
                  <Chevron
                    icon="back"
                    label={t("calendar.previous")}
                    disabled={!state.canPrev}
                    onPress={state.prev}
                  />
                  <Chevron
                    icon="chevron"
                    label={t("calendar.next")}
                    disabled={!state.canNext}
                    onPress={state.next}
                  />
                </View>
                {data ? (
                  <Animated.View key={month} entering={monthFade}>
                    <MonthSummary data={data} format={format} onOpen={open} />
                  </Animated.View>
                ) : failure ? (
                  failed
                ) : (
                  <MonthSkeleton />
                )}
              </View>
            </Swipe>
          </SectionEntrance>
          {latest.recentMonths.length > 0 ? (
            <SectionEntrance index={1}>
              <RecentMonths
                months={latest.recentMonths}
                today={latest.today}
                format={format}
                onPressMonth={showMonth}
              />
            </SectionEntrance>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
