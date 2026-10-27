import { View } from "react-native";

import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { PayMonth, Rate } from "@/domain/types";
import { useTranslation } from "@/i18n";

type Format = ReturnType<typeof useFormat>;
type Translate = ReturnType<typeof useTranslation>["t"];

/** What a tile or the pay card opens: the breakdown sheet's `kind`. */
export type BreakdownKind = "pay" | "hours" | "packages" | "km";

export const breakdownKinds: readonly BreakdownKind[] = ["pay", "hours", "packages", "km"];

/**
 * The rates behind a month's pay, one line each: the first as "Hourly · €16.00 / h", every later change in the
 * month and the upcoming one as "From 2 Nov: €150.00 per shift".
 */
export function rateLines(data: PayMonth, format: Format, t: Translate): string[] {
  const line = (rate: Rate, from: boolean) => {
    const amount = format.money(rate.amountMinor);
    if (!from) return t(rate.kind === "daily" ? "pay.month.rateDaily" : "pay.month.rateHourly", { amount });
    const date = format.shortDay(rate.effectiveFrom);
    return t(rate.kind === "daily" ? "pay.month.nextDaily" : "pay.month.nextHourly", { date, amount });
  };
  const lines = data.rates.map((rate, i) => line(rate, i > 0));
  if (data.next) lines.push(line(data.next, true));
  return lines.length > 0 ? lines : [t("pay.month.noRate")];
}

function StatTile({
  icon,
  value,
  caption,
  label,
  onPress,
}: {
  icon: IconName;
  value: string;
  caption: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale className="flex-1" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Surface variant="outlined" className="gap-2 p-4">
        <Icon name={icon} size="sm" color="secondary-ink" />
        <ThemedText variant="number" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        <ThemedText variant="footnote" numberOfLines={1}>
          {caption}
        </ThemedText>
      </Surface>
    </PressableScale>
  );
}

// One month from approved shifts only: the pay card and the hours, packages and km tiles, each opening its
// day-by-day breakdown. Pay is computed by the API from approved shifts; the client only shows it.
export function MonthSummary({
  data,
  format,
  onOpen,
}: {
  data: PayMonth;
  format: Format;
  onOpen: (kind: BreakdownKind) => void;
}) {
  const { t } = useTranslation();
  const { totals } = data;
  const empty = totals.approvedShifts === 0;
  const current = data.month === data.today.slice(0, 7);
  const daily = data.rates.at(-1)?.kind === "daily";
  const caption = empty
    ? current
      ? t("pay.month.empty")
      : t("pay.month.emptyPast")
    : daily
      ? totals.approvedShifts === 1
        ? t("pay.month.approvedShiftsOne")
        : t("pay.month.approvedShiftsOther", { count: totals.approvedShifts })
      : t("pay.month.approvedHours", { hours: format.hours(totals.approvedMinutes) });

  return (
    <View className="gap-3">
      <PressableScale accessibilityRole="button" accessibilityLabel={t("pay.open.pay")} onPress={() => onOpen("pay")}>
        <Surface variant="outlined" className="gap-2 p-5">
          <View className="flex-row items-center justify-between gap-4">
            <ThemedText variant="footnote" color="ink-muted">
              {t("pay.month.estimatedPay")}
            </ThemedText>
            <Icon name="chevron" size="sm" color="ink-muted" />
          </View>
          <ThemedText variant="display" color="ink" numberOfLines={1} adjustsFontSizeToFit>
            {format.money(totals.payMinor)}
          </ThemedText>
          <ThemedText variant="caption" color="ink-muted">
            {caption}
          </ThemedText>
          {totals.spesenMinor > 0 ? (
            <ThemedText variant="caption" color="ink">
              {t("pay.month.spesen", { amount: format.money(totals.spesenMinor) })}
            </ThemedText>
          ) : null}
          <View>
            {rateLines(data, format, t).map((line) => (
              <ThemedText key={line} variant="caption" color="ink-muted">
                {line}
              </ThemedText>
            ))}
          </View>
          {totals.pendingCount > 0 ? (
            <Tag
              tone="info"
              size="sm"
              className="mt-1"
              label={
                totals.pendingCount === 1
                  ? t("pay.month.pendingOne")
                  : t("pay.month.pendingOther", { count: totals.pendingCount })
              }
            />
          ) : null}
        </Surface>
      </PressableScale>

      <View className="flex-row gap-3">
        <StatTile
          icon="hours"
          value={clock(totals.approvedMinutes)}
          caption={t("units.hours")}
          label={t("pay.open.hours")}
          onPress={() => onOpen("hours")}
        />
        <StatTile
          icon="packages"
          value={format.count(totals.packages)}
          caption={t("units.packages")}
          label={t("pay.open.packages")}
          onPress={() => onOpen("packages")}
        />
        <StatTile
          icon="km"
          value={format.count(totals.km)}
          caption={t("units.km")}
          label={t("pay.open.km")}
          onPress={() => onOpen("km")}
        />
      </View>
    </View>
  );
}
