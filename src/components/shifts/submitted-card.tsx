import { View } from "react-native";

import { Button } from "@/components/button";
import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { delivered, elapsedMinutes, kmDriven, type ShiftDraft } from "@/shifts/draft";

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

// Phase 3: read-only, like Home's Today card. onReset is the dev-only way to run the flow again.
export function SubmittedCard({
  draft,
  format,
  onReset,
}: {
  draft: ShiftDraft;
  format: ReturnType<typeof useFormat>;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const minutes = draft.startedAt && draft.finishedAt ? elapsedMinutes(draft.startedAt, draft.finishedAt) : 0;

  return (
    <Surface className="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="label">{t("shifts.submitted.title")}</ThemedText>
        <Tag tone="submitted" size="sm" label={t("status.submitted")} />
      </View>
      <View className="flex-row gap-3">
        <Metric icon="hours" value={clock(minutes)} caption={t("units.hours")} />
        <Metric
          icon="packages"
          value={format.count(delivered(draft) ?? 0)}
          caption={t("shifts.submitted.delivered")}
        />
        <Metric icon="km" value={format.count(kmDriven(draft) ?? 0)} caption={t("units.km")} />
      </View>
      <View className="flex-row items-center gap-2 border-t border-border pt-4">
        <Icon name="car" size="sm" color="ink-muted" />
        <ThemedText variant="label">{draft.bus}</ThemedText>
        <ThemedText variant="footnote" numberOfLines={1} className="flex-1">
          · {draft.station}
        </ThemedText>
      </View>
      <ThemedText variant="footnote">{t("shifts.submitted.waiting")}</ThemedText>
      {onReset ? <Button title={t("shifts.submitted.reset")} variant="destructive" onPress={onReset} /> : null}
    </Surface>
  );
}
