import { View } from "react-native";

import { Button } from "@/components/button";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import type { Bus, Station } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { canStart, type ShiftFields } from "@/shifts/draft";

import { NumberField } from "./number-field";
import { StationBusPickers } from "./station-bus-pickers";

// Phase 1: what the courier knows before driving off.
export function StartCard({
  fields,
  stations,
  buses,
  starting,
  onChange,
  onStart,
}: {
  fields: ShiftFields;
  stations: Station[];
  buses: Bus[];
  starting: boolean;
  onChange: (fields: Partial<ShiftFields>) => void;
  onStart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="label">{t("shifts.start.title")}</ThemedText>
        <Tag tone="draft" size="sm" label={t("shifts.phase.notStarted")} />
      </View>
      <StationBusPickers fields={fields} stations={stations} buses={buses} onChange={onChange} />
      <View className="flex-row gap-3">
        <NumberField
          label={t("shifts.fields.startKm")}
          icon="km"
          value={fields.startKm}
          onChange={(startKm) => onChange({ startKm })}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.loaded")}
          icon="packages"
          value={fields.loaded}
          onChange={(loaded) => onChange({ loaded })}
          className="flex-1"
        />
      </View>
      <Button title={t("shifts.start.button")} disabled={!canStart(fields)} loading={starting} onPress={onStart} />
    </Surface>
  );
}
