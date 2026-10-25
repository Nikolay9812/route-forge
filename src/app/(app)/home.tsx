import { router } from "expo-router";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { HomeHeader } from "@/components/home/home-header";
import { HomeSkeleton } from "@/components/home/home-skeleton";
import { MonthSummary } from "@/components/home/month-summary";
import { RecentShifts } from "@/components/home/recent-shifts";
import { SectionEntrance } from "@/components/home/section-entrance";
import { TodayCard } from "@/components/home/today-card";
import { Notice } from "@/components/notice";
import { useHomeSummary } from "@/home/use-home-summary";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

// Courier home: today's shift, this month's approved totals and pay, recent shifts.
// Shift detail is a later plan, so its entry points open the Shifts tab.

// Formats nothing visible: only used until the firm's own settings have loaded.
const beforeLoad = { timeZone: "UTC", currency: "EUR" };

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { summary, refreshing, refresh, retry } = useHomeSummary();
  const insets = useSafeAreaInsets();
  const spinner = useThemeColor("secondary-ink");
  const firm = summary.status === "ready" ? summary.data.firm : beforeLoad;
  const format = useFormat(firm.timeZone, firm.currency);

  const goToShifts = () => router.navigate("/shifts");
  const fullName = user?.fullName ?? "";

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      // iOS insets the content for the status bar and the tab bar itself; Android's tab bar sits below the screen.
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8 }}
      refreshControl={
        summary.status === "ready" ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      {summary.status === "loading" ? (
        <HomeSkeleton />
      ) : (
        <>
          <SectionEntrance index={0}>
            <HomeHeader
              fullName={fullName}
              hour={summary.hour}
              dateLabel={summary.status === "ready" ? format.longDay(summary.data.date) : undefined}
              firmName={summary.status === "ready" ? summary.data.firm.name : undefined}
              onProfilePress={() => router.navigate("/profile")}
            />
          </SectionEntrance>

          {summary.status === "ready" ? (
            <>
              <SectionEntrance index={1}>
                <TodayCard shift={summary.data.today} format={format} onAction={goToShifts} />
              </SectionEntrance>
              <SectionEntrance index={2}>
                <MonthSummary
                  date={summary.data.date}
                  totals={summary.data.totals}
                  rate={summary.data.rate}
                  format={format}
                />
              </SectionEntrance>
              {summary.data.recent.length > 0 ? (
                <SectionEntrance index={3}>
                  <RecentShifts
                    shifts={summary.data.recent}
                    format={format}
                    onSeeAll={goToShifts}
                    onPressShift={(shift) => router.navigate({ pathname: "/shifts/[id]", params: { id: shift.id } })}
                  />
                </SectionEntrance>
              ) : null}
            </>
          ) : summary.status === "role" ? (
            <SectionEntrance index={1}>
              <Notice icon="profile" title={t("firm.roleNotYet.title")} body={t("firm.roleNotYet.body")} />
            </SectionEntrance>
          ) : (
            <SectionEntrance index={1}>
              <View className="gap-3">
                <Alert
                  tone={summary.status === "offline" ? "offline" : "danger"}
                  message={summary.status === "offline" ? t("home.offline") : t("home.error")}
                />
                <Button title={t("home.retry")} variant="secondary" onPress={retry} />
              </View>
            </SectionEntrance>
          )}
        </>
      )}
    </ScrollView>
  );
}
