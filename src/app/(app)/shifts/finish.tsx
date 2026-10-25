import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ApiFailure } from "@/api/client";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { useFormat } from "@/components/home/format";
import { ShiftSummary } from "@/components/shifts/shift-summary";
import { ThemedText } from "@/components/themed-text";
import type { TranslationKey } from "@/i18n";
import { useTranslation } from "@/i18n";
import { useTodayShift } from "@/shifts/today-shift";

function submitMessage(failure: ApiFailure): TranslationKey {
  switch (failure) {
    case "offline":
      return "shifts.finish.offline";
    case "invalid":
    case "endKmMissing":
    case "endBelowStart":
    case "returnedAboveLoaded":
      return "shifts.finish.invalid";
    case "notEditable":
      return "shifts.finish.notEditable";
    default:
      return "shifts.finish.error";
  }
}

// Form sheet sized to its content, so nothing here uses flex-1. Android shows no header in sheets,
// so the title is part of the content.
export default function FinishShift() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { load, shift, phase, fields, submit } = useTodayShift();
  const firm = load.status === "ready" ? load.firm : null;
  const format = useFormat(firm?.timeZone ?? "UTC", firm?.currency ?? "EUR");
  const [end] = useState(Date.now);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  // Opened without a running shift (e.g. a deep link): nothing to finish.
  useEffect(() => {
    if (phase !== "inProgress" && !submitting) router.back();
  }, [phase, submitting]);

  if (load.status !== "ready" || !shift) return null;

  const stationName = load.stations.find((s) => s.id === fields.stationId)?.name ?? shift.depot.name;
  const busPlate = load.buses.find((b) => b.id === fields.busId)?.plate ?? shift.car.plate;

  const onSubmit = async () => {
    setSubmitting(true);
    setFailure(null);
    const result = await submit();
    if (!result) return router.back();
    setFailure(result);
    setSubmitting(false);
  };

  return (
    <View className="gap-4 bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <ThemedText variant="heading" accessibilityRole="header">
          {t("shifts.finish.title")}
        </ThemedText>
        <ThemedText variant="body">{t("shifts.finish.body")}</ThemedText>
      </View>
      <ShiftSummary
        fields={fields}
        stationName={stationName}
        busPlate={busPlate}
        startedAt={Date.parse(shift.startedAt)}
        end={end}
        format={format}
      />
      {failure ? (
        <Alert tone={failure === "offline" ? "offline" : "danger"} message={t(submitMessage(failure))} />
      ) : null}
      <View className="gap-3">
        <Button title={t("shifts.finish.submit")} loading={submitting} onPress={() => void onSubmit()} />
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
