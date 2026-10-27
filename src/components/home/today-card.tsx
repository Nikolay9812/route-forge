import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { RejectionAlert } from "@/components/shifts/rejection-alert";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { delivered, kmDriven, minutesBetween } from "@/domain/shift";
import type { Shift } from "@/domain/types";
import { useTranslation, type TranslationKey } from "@/i18n";

import { clock, type useFormat } from "./format";

function Metric({ icon, value, caption }: { icon: IconName; value: string; caption: string }) {
  return (
    <View className="flex-1 gap-1">
      <Icon name={icon} size="sm" color="ink-muted" />
      <ThemedText variant="number" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText variant="footnote" numberOfLines={1}>
        {caption}
      </ThemedText>
    </View>
  );
}

const actions: Partial<Record<Shift["status"], TranslationKey>> = {
  draft: "home.today.continueShift",
  rejected: "home.today.fixShift",
};

export function TodayCard({
  shift,
  format,
  onAction,
}: {
  shift: Shift | null;
  format: ReturnType<typeof useFormat>;
  /** Log, continue or fix today's shift. */
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const action = shift ? actions[shift.status] : "home.today.logShift";
  // A shift still running has no working time yet: show it as of when Home loaded.
  const [openedAt] = useState(Date.now);

  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-center justify-between">
        <ThemedText variant="label">{t("home.today.title")}</ThemedText>
        {shift ? <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} /> : null}
      </View>

      {shift ? (
        <>
          <View className="flex-row gap-3">
            <Metric
              icon="hours"
              value={clock(shift.workedMinutes ?? minutesBetween(shift.startedAt, new Date(openedAt).toISOString()))}
              caption={t("units.hours")}
            />
            <Metric icon="packages" value={format.count(delivered(shift))} caption={t("units.packages")} />
            <Metric icon="km" value={format.count(kmDriven(shift) ?? 0)} caption={t("units.km")} />
          </View>
          <View className="flex-row items-center gap-2 border-t border-border pt-4">
            <Icon name="car" size="sm" color="ink-muted" />
            <ThemedText variant="label">{shift.car.plate}</ThemedText>
            <ThemedText variant="footnote" numberOfLines={1} className="flex-1">
              · {shift.depot.name}
            </ThemedText>
          </View>
          <RejectionAlert rejection={shift.rejection} />
        </>
      ) : (
        <View className="gap-2">
          <View className="mb-1 size-ghost items-center justify-center rounded-full bg-secondary-soft">
            <Icon name="shifts" color="secondary-ink" />
          </View>
          <ThemedText variant="title">{t("home.today.noShiftTitle")}</ThemedText>
          <ThemedText variant="body">{t("home.today.noShiftBody")}</ThemedText>
        </View>
      )}

      {action ? <Button title={t(action)} onPress={onAction} /> : null}
    </Surface>
  );
}
