import { useEffect, useState } from "react";
import { View } from "react-native";

import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { elapsedMinutes } from "@/shifts/draft";

/** Re-renders every 15 s so the elapsed minutes roll over close to on time. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Phase 2: the running clock. The start time is when the courier tapped Start; only a reviewer corrects it.
export function TimeCard({ startedAt, format }: { startedAt: number; format: ReturnType<typeof useFormat> }) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    <Surface className="gap-3 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="label">{t("shifts.time.title")}</ThemedText>
        <Tag tone="draft" size="sm" label={t("shifts.phase.inProgress")} />
      </View>
      <ThemedText variant="number">{clock(elapsedMinutes(startedAt, now))}</ThemedText>
      <View className="flex-row items-center gap-2">
        <Icon name="hours" size="sm" color="ink-muted" />
        <ThemedText variant="footnote" className="flex-1">
          {t("shifts.time.startedAt", { time: format.time(startedAt) })}
        </ThemedText>
      </View>
    </Surface>
  );
}
