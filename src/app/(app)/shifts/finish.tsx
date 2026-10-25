import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { ShiftSummary } from "@/components/shifts/shift-summary";
import { ThemedText } from "@/components/themed-text";
import { sampleFirm } from "@/home/sample";
import { useTranslation } from "@/i18n";
import { useShiftDraft } from "@/shifts/shift-draft-context";

// Form sheet sized to its content, so nothing here uses flex-1. Android shows no header in sheets,
// so the title is part of the content.
export default function FinishShift() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  const { draft, submit } = useShiftDraft();
  const format = useFormat(sampleFirm.timeZone, sampleFirm.currency);
  const [end] = useState(Date.now);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);

  // Opened without a running shift (e.g. a deep link): nothing to finish.
  useEffect(() => {
    if (draft.phase !== "inProgress" && !submitting) router.back();
  }, [draft.phase, submitting]);

  const onSubmit = async () => {
    setSubmitting(true);
    setOffline(false);
    try {
      await submit({ offline: __DEV__ && sample === "offline" });
      router.back();
    } catch {
      setOffline(true);
      setSubmitting(false);
    }
  };

  return (
    <View className="gap-4 bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <ThemedText variant="heading" accessibilityRole="header">
          {t("shifts.finish.title")}
        </ThemedText>
        <ThemedText variant="body">{t("shifts.finish.body")}</ThemedText>
      </View>
      <ShiftSummary draft={draft} end={end} format={format} />
      {offline ? <Alert tone="offline" message={t("shifts.finish.offline")} /> : null}
      <View className="gap-3">
        <Button title={t("shifts.finish.submit")} loading={submitting} onPress={onSubmit} />
        <Button
          title={t("shifts.finish.keepEditing")}
          variant="secondary"
          disabled={submitting}
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}
