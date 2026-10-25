import { View } from "react-native";

import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { MonthTotals } from "@/domain/salary";
import { useTranslation } from "@/i18n";

import type { useFormat } from "./format";

function StatTile({ icon, value, caption }: { icon: IconName; value: string; caption: string }) {
  return (
    <Surface variant="outlined" className="flex-1 gap-2 p-4">
      <Icon name={icon} size="sm" color="secondary-ink" />
      <ThemedText variant="number" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText variant="footnote" numberOfLines={1}>
        {caption}
      </ThemedText>
    </Surface>
  );
}

// This month from approved shifts only. Pay is an estimate the client shows; the API stays the authority.
export function MonthSummary({
  date,
  totals,
  format,
}: {
  date: string;
  totals: MonthTotals;
  format: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();
  const empty = totals.approvedMinutes === 0;

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between gap-4">
        <ThemedText variant="title" accessibilityRole="header">
          {format.month(date)}
        </ThemedText>
        <ThemedText variant="footnote">{t("home.month.approvedOnly")}</ThemedText>
      </View>

      <View className="gap-2 rounded-lg bg-inverse p-5">
        <ThemedText variant="footnote" color="on-inverse-muted">
          {t("home.month.estimatedPay")}
        </ThemedText>
        <ThemedText variant="display" color="on-inverse" numberOfLines={1} adjustsFontSizeToFit>
          {format.money(totals.payMinor)}
        </ThemedText>
        <ThemedText variant="caption" color="on-inverse-muted">
          {empty ? t("home.month.empty") : t("home.month.approvedHours", { hours: format.hours(totals.approvedMinutes) })}
        </ThemedText>
        {totals.pendingCount > 0 ? (
          <Tag
            tone="info"
            size="sm"
            className="mt-1"
            label={
              totals.pendingCount === 1
                ? t("home.month.pendingOne")
                : t("home.month.pendingOther", { count: totals.pendingCount })
            }
          />
        ) : null}
      </View>

      <View className="flex-row gap-3">
        <StatTile icon="hours" value={format.hours(totals.approvedMinutes)} caption={t("units.hours")} />
        <StatTile icon="packages" value={format.count(totals.packages)} caption={t("units.packages")} />
        <StatTile icon="km" value={format.count(totals.km)} caption={t("units.km")} />
      </View>
    </View>
  );
}
