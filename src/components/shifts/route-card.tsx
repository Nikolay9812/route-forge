import { View } from "react-native";

import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { kmDriven, type ShiftFields } from "@/shifts/draft";

import { ChoiceChips } from "./choice-chips";
import { NumberField } from "./number-field";

// Phase 2: station, bus and odometer readings, all still editable.
export function RouteCard({
  draft,
  stations,
  buses,
  format,
  onChange,
}: {
  draft: ShiftFields;
  stations: string[];
  buses: string[];
  format: ReturnType<typeof useFormat>;
  onChange: (fields: Partial<ShiftFields>) => void;
}) {
  const { t } = useTranslation();
  const driven = kmDriven(draft);

  return (
    <Surface className="gap-4 p-5">
      <ThemedText variant="title" accessibilityRole="header">
        {t("shifts.route.title")}
      </ThemedText>
      <ChoiceChips
        label={t("shifts.fields.station")}
        icon="depot"
        options={stations}
        selected={draft.station}
        onSelect={(station) => onChange({ station })}
      />
      <ChoiceChips
        label={t("shifts.fields.bus")}
        icon="car"
        options={buses}
        selected={draft.bus}
        onSelect={(bus) => onChange({ bus })}
      />
      <View className="flex-row items-start gap-3">
        <NumberField
          label={t("shifts.fields.startKm")}
          icon="km"
          value={draft.startKm}
          onChange={(startKm) => onChange({ startKm })}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.endKm")}
          icon="km"
          value={draft.endKm}
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
