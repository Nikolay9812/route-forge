import { View } from "react-native";

import type { useFormat } from "@/components/home/format";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { delivered, type ShiftFields } from "@/shifts/draft";

import { NumberField } from "./number-field";

// Phase 2: loaded, returned and pickups are typed; delivered follows as loaded − returned.
export function PackagesCard({
  draft,
  format,
  onChange,
}: {
  draft: ShiftFields;
  format: ReturnType<typeof useFormat>;
  onChange: (fields: Partial<ShiftFields>) => void;
}) {
  const { t } = useTranslation();
  const count = delivered(draft);

  return (
    <Surface className="gap-4 p-5">
      <View className="gap-1">
        <ThemedText variant="title" accessibilityRole="header">
          {t("shifts.packages.title")}
        </ThemedText>
        <ThemedText variant="footnote" weight="regular">
          {t("shifts.packages.help")}
        </ThemedText>
      </View>
      <View className="gap-3">
        <View className="flex-row items-start gap-3">
          <NumberField
            label={t("shifts.fields.loaded")}
            icon="packages"
            value={draft.loaded}
            onChange={(loaded) => onChange({ loaded })}
            className="flex-1"
          />
          <NumberField
            label={t("shifts.fields.returned")}
            value={draft.returned}
            onChange={(returned) => onChange({ returned })}
            error={count !== null && count < 0 ? t("shifts.packages.returnedAboveLoaded") : undefined}
            className="flex-1"
          />
        </View>
        <NumberField
          label={t("shifts.fields.pickups")}
          value={draft.pickups}
          onChange={(pickups) => onChange({ pickups })}
        />
      </View>
      {count !== null && count >= 0 ? (
        <ThemedText variant="footnote">{t("shifts.packages.delivered", { packages: format.count(count) })}</ThemedText>
      ) : null}
    </Surface>
  );
}
