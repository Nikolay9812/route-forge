import { View } from "react-native";

import { Button } from "@/components/button";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { canStart, type ShiftFields } from "@/shifts/draft";

import { ChoiceChips } from "./choice-chips";
import { NumberField } from "./number-field";

// Phase 1: what the courier knows before driving off.
export function StartCard({
  draft,
  stations,
  buses,
  onChange,
  onStart,
}: {
  draft: ShiftFields;
  stations: string[];
  buses: string[];
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
      <View className="flex-row gap-3">
        <NumberField
          label={t("shifts.fields.startKm")}
          icon="km"
          value={draft.startKm}
          onChange={(startKm) => onChange({ startKm })}
          className="flex-1"
        />
        <NumberField
          label={t("shifts.fields.loaded")}
          icon="packages"
          value={draft.loaded}
          onChange={(loaded) => onChange({ loaded })}
          className="flex-1"
        />
      </View>
      <Button title={t("shifts.start.button")} disabled={!canStart(draft)} onPress={onStart} />
    </Surface>
  );
}
