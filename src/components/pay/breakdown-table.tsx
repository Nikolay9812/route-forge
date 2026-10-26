import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Divider } from "@/components/divider";
import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { PayDay, PayMonth } from "@/domain/types";
import { useTranslation, type TranslationKey } from "@/i18n";

import { rateLines, type BreakdownKind } from "./month-summary";

type Format = ReturnType<typeof useFormat>;

const tabular = { fontVariant: ["tabular-nums" as const] };

const titles: Record<BreakdownKind, TranslationKey> = {
  pay: "pay.breakdown.title.pay",
  hours: "pay.breakdown.title.hours",
  packages: "pay.breakdown.title.packages",
  km: "pay.breakdown.title.km",
};

/** The value columns of one breakdown, right of the day: header, row values and totals. */
function columnsOf(kind: BreakdownKind, data: PayMonth, format: Format, t: ReturnType<typeof useTranslation>["t"]) {
  const hours = {
    head: t("pay.breakdown.hours"),
    row: (day: PayDay) => format.hoursTenths(day.minutes),
    total: format.hoursTenths(data.totals.approvedMinutes),
  };
  switch (kind) {
    case "pay":
      return [
        hours,
        {
          head: t("pay.breakdown.pay"),
          row: (day: PayDay) => (day.payMinor === null ? "–" : format.money(day.payMinor)),
          total: format.money(data.totals.payMinor),
        },
      ];
    case "hours":
      return [hours];
    case "packages":
      return [
        { head: t("pay.breakdown.delivered"), row: (day: PayDay) => format.count(day.packages), total: format.count(data.totals.packages) },
      ];
    case "km":
      return [{ head: t("units.km"), row: (day: PayDay) => format.count(day.km), total: format.count(data.totals.km) }];
  }
}

// One month, one measure, day by day: approved days add up to the total row; submitted days show greyed with a
// "Pending" tag and don't count. Totals come from the API, never summed here.
export function BreakdownTable({
  kind,
  data,
  format,
  onOpenDay,
}: {
  kind: BreakdownKind;
  data: PayMonth;
  format: Format;
  onOpenDay: (day: PayDay) => void;
}) {
  const { t } = useTranslation();
  const columns = columnsOf(kind, data, format, t);
  const month = format.calendarMonth(`${data.month}-01`, data.today);

  return (
    <View className="gap-4">
      <ThemedText variant="heading" accessibilityRole="header">
        {t(titles[kind], { month })}
      </ThemedText>

      {data.days.length === 0 ? (
        <ThemedText variant="body" color="ink-muted" className="py-8 text-center">
          {t("pay.breakdown.empty")}
        </ThemedText>
      ) : (
        <>
          <Surface variant="outlined">
            <View className="flex-row gap-3 px-4 pt-3 pb-2">
              <ThemedText variant="footnote" className="flex-1">
                {t("pay.breakdown.day")}
              </ThemedText>
              {columns.map((column) => (
                <ThemedText key={column.head} variant="footnote" className="min-w-16 text-right">
                  {column.head}
                </ThemedText>
              ))}
            </View>
            {data.days.map((day) => {
              const pending = day.status === "submitted";
              const color = pending ? "ink-muted" : "ink";
              return (
                <Fragment key={day.shiftId}>
                  <Divider className="mx-4" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("pay.breakdown.openDay", { day: format.longDay(day.date) })}
                    onPress={() => onOpenDay(day)}
                    className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
                  >
                    <View className="flex-1 flex-row flex-wrap items-center gap-2">
                      <ThemedText variant="body" color={color} numberOfLines={1}>
                        {format.shortDay(day.date)}
                      </ThemedText>
                      {pending ? <Tag tone="submitted" size="sm" label={t("pay.pending")} /> : null}
                    </View>
                    {columns.map((column) => (
                      <ThemedText key={column.head} variant="body" color={color} className="min-w-16 text-right" style={tabular}>
                        {column.row(day)}
                      </ThemedText>
                    ))}
                  </Pressable>
                </Fragment>
              );
            })}
          </Surface>

          <View className="flex-row gap-3 px-4">
            <ThemedText variant="label" color="ink" className="flex-1">
              {t("pay.breakdown.total")}
            </ThemedText>
            {columns.map((column) => (
              <ThemedText key={column.head} variant="label" color="ink" className="min-w-16 text-right" style={tabular}>
                {column.total}
              </ThemedText>
            ))}
          </View>
        </>
      )}

      {kind === "pay" ? (
        <View className="px-4">
          {rateLines(data, format, t).map((line) => (
            <ThemedText key={line} variant="footnote">
              {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}
