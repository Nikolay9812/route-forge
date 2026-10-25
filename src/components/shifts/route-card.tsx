import { View } from "react-native";

import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import type { Bus, Station } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { kmDrivenOf, type ShiftFields } from "@/shifts/draft";

import { NumberField } from "./number-field";
import { StationBusPickers } from "./station-bus-pickers";

// Phase 2: station, bus and odometer readings, all still editable.
export function RouteCard({
  fields,
  stations,
  buses,
  format,
  onChange,
}: {
  fields: ShiftFields;
  stations: Station[];
  buses: Bus[];
  format: ReturnType<typeof useFormat>;
  onChange: (fields: Partial<ShiftFields>) => void;
}) {
  const { t } = useTranslation();
  const driven = kmDrivenOf(fields);

  return (
    <Surface className="gap-4 p-5">
      <ThemedText variant="title" accessibilityRole="header">
        {t("shifts.route.title")}
      </ThemedText>
      <StationBusPickers fields={fields} stations={stations} buses={buses} onChange={onChange} />
      <View className="flex-row items-start gap-3">
        <NumberField
          label={t("shifts.fields.startKm")}
          icon="km"
          value={fields.startKm}
          onChange={(startKm) => onChange({ startKm })}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.endKm")}
          icon="km"
          value={fields.endKm}
          onChange={(endKm) => onChange({ endKm })}
          error={driven !== null && driven < 0 ? t("shifts.route.endBelowStart") : undefined}
          className="flex-1"
        />
      </View>
      {driven !== null && driven >= 0 ? (
        <ThemedText variant="footnote">{t("shifts.route.driven", { km: format.count(driven) })}</ThemedText>
      ) : null}
    </Surface>
  );
}
