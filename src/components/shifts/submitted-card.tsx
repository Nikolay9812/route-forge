import { View } from "react-native";

import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { delivered, kmDriven } from "@/domain/shift";
import type { Shift } from "@/domain/types";
import { useTranslation } from "@/i18n";

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

// Phase 3: read-only once submitted (or approved), like Home's Today card.
export function SubmittedCard({ shift, format }: { shift: Shift; format: ReturnType<typeof useFormat> }) {
  const { t } = useTranslation();

  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="label">{t("shifts.submitted.title")}</ThemedText>
        <Tag tone={shift.status} size="sm" label={t(`status.${shift.status}`)} />
      </View>
      <View className="flex-row gap-3">
        <Metric icon="hours" value={clock(shift.minutes ?? 0)} caption={t("units.hours")} />
        <Metric icon="packages" value={format.count(delivered(shift))} caption={t("shifts.submitted.delivered")} />
        <Metric icon="km" value={format.count(kmDriven(shift) ?? 0)} caption={t("units.km")} />
      </View>
      <View className="flex-row items-center gap-2 border-t border-border pt-4">
        <Icon name="car" size="sm" color="ink-muted" />
        <ThemedText variant="label">{shift.car.plate}</ThemedText>
        <ThemedText variant="footnote" numberOfLines={1} className="flex-1">
          · {shift.depot.name}
        </ThemedText>
      </View>
      {shift.status === "submitted" ? <ThemedText variant="footnote">{t("shifts.submitted.waiting")}</ThemedText> : null}
    </Surface>
  );
}
