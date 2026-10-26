import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import type { MonthPay } from "@/domain/types";
import { useTranslation } from "@/i18n";

// The months before the current one, like Home's recent shifts: pay and approved hours per month. A row shows that
// month above. Full-width rows highlight their background on press instead of scaling.
export function RecentMonths({
  months,
  today,
  format,
  onPressMonth,
}: {
  months: MonthPay[];
  today: string;
  format: ReturnType<typeof useFormat>;
  onPressMonth: (month: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <ThemedText variant="title" accessibilityRole="header">
        {t("pay.recent.title")}
      </ThemedText>
      <Surface className="overflow-hidden">
        {months.map((item, i) => {
          const name = format.calendarMonth(`${item.month}-01`, today);
          const hours = format.hours(item.approvedMinutes);
          const summary =
            item.approvedShifts === 1
              ? t("pay.recent.summaryOne", { hours })
              : t("pay.recent.summaryOther", {
                  hours,
                  count: item.approvedShifts,
                });
          return (
            <Fragment key={item.month}>
              {i > 0 ? <Divider className="mx-4" /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("pay.recent.open", { month: name })}
                onPress={() => onPressMonth(item.month)}
                className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
              >
                <View className="flex-1 gap-0.5">
                  <ThemedText variant="label" numberOfLines={1}>
                    {name}
                  </ThemedText>
                  <ThemedText variant="footnote" numberOfLines={1}>
                    {summary}
                  </ThemedText>
                </View>
                <ThemedText
                  variant="label"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {format.money(item.payMinor)}
                </ThemedText>
              </Pressable>
            </Fragment>
          );
        })}
      </Surface>
    </View>
  );
}
