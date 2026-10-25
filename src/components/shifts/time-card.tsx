import { useEffect, useState } from "react";
import { View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { Button } from "@/components/button";
import { clock, type useFormat } from "@/components/home/format";
import { Icon } from "@/components/icon";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { elapsedMinutes, parseClock, todayAt } from "@/shifts/draft";

/** Re-renders every 15 s so the elapsed minutes roll over close to on time. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Phase 2: the running clock. The start time can be fixed if the courier forgot to tap Start.
export function TimeCard({
  startedAt,
  timeZone,
  format,
  onChangeStart,
}: {
  startedAt: number;
  timeZone: string;
  format: ReturnType<typeof useFormat>;
  /** Saves the new start time; resolves the failure, or null once saved. */
  onChangeStart: (at: number) => Promise<ApiFailure | null>;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minute = parseClock(editing ?? "");
    if (minute === null) return setError(t("shifts.time.invalid"));
    const at = todayAt(minute, timeZone);
    if (at === null) return setError(t("shifts.time.future"));
    setSaving(true);
    const failure = await onChangeStart(at);
    setSaving(false);
    if (failure) return setError(t(failure === "offline" ? "shifts.time.offline" : "shifts.time.invalid"));
    setEditing(null);
    setError(undefined);
  };

  const cancel = () => {
    setEditing(null);
    setError(undefined);
  };

  return (
    <Surface className="gap-3 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <ThemedText variant="label">{t("shifts.time.title")}</ThemedText>
        <Tag tone="draft" size="sm" label={t("shifts.phase.inProgress")} />
      </View>
      <ThemedText variant="number">{clock(elapsedMinutes(startedAt, now))}</ThemedText>
      {editing === null ? (
        <View className="flex-row items-center gap-2">
          <Icon name="hours" size="sm" color="ink-muted" />
          <ThemedText variant="footnote" className="flex-1">
            {t("shifts.time.startedAt", { time: format.time(startedAt) })}
          </ThemedText>
          <Button
            title={t("shifts.time.edit")}
            size="sm"
            variant="secondary"
            onPress={() => setEditing(format.time(startedAt))}
          />
        </View>
      ) : (
        <View className="gap-3">
          <TextField
            label={t("shifts.time.label")}
            accessibilityLabel={t("shifts.time.label")}
            icon="hours"
            value={editing}
            onChangeText={(text) => {
              setEditing(text.replace(/[^\d:]/g, "").slice(0, 5));
              setError(undefined);
            }}
            keyboardType="numbers-and-punctuation"
            placeholder="07:30"
            autoFocus
            onSubmitEditing={() => void save()}
            error={error}
          />
          <View className="flex-row gap-3">
            <Button title={t("shifts.time.cancel")} variant="secondary" onPress={cancel} className="flex-1" />
            <Button title={t("shifts.time.save")} loading={saving} onPress={() => void save()} className="flex-1" />
          </View>
        </View>
      )}
    </Surface>
  );
}
